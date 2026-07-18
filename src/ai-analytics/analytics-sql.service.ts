import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient } from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateAnalyticsSql } from './sql-validator';

export interface AnalyticsSqlResult {
  sql: string;
  executableSql: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  referencedViews: string[];
  durationMs: number;
}

interface AnalyticsPoolTarget {
  label: 'AI_ANALYTICS_DATABASE_URL' | 'DATABASE_URL';
  pool: Pool;
}

@Injectable()
export class AnalyticsSqlService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsSqlService.name);
  private readonly pools: AnalyticsPoolTarget[];
  private readonly maxRows: number;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    const analyticsConnectionString =
      config.get<string>('AI_ANALYTICS_DATABASE_URL')?.trim() || null;
    const appConnectionString = config.get<string>('DATABASE_URL')?.trim() || null;
    this.maxRows = this.numberFromConfig(
      config.get<string>('AI_ANALYTICS_MAX_RESULT_ROWS'),
      100,
      10,
      500,
    );
    this.timeoutMs = this.numberFromConfig(
      config.get<string>('AI_ANALYTICS_QUERY_TIMEOUT_MS'),
      5000,
      1000,
      30000,
    );

    this.pools = this.poolTargets(analyticsConnectionString, appConnectionString);
  }

  async onModuleDestroy() {
    await Promise.all(this.pools.map((target) => target.pool.end()));
  }

  async execute(userId: string, sql: string): Promise<AnalyticsSqlResult> {
    if (!this.pools.length) {
      throw new ServiceUnavailableException(
        'AI analytics database connection is not configured.',
      );
    }

    const validated = validateAnalyticsSql(sql, { maxRows: this.maxRows + 1 });
    let lastError: unknown = null;

    for (let index = 0; index < this.pools.length; index += 1) {
      const target = this.pools[index];
      const startedAt = Date.now();
      let client: PoolClient | null = null;

      try {
        client = await target.pool.connect();
        await this.beginReadOnly(client, userId);
        const result = await client.query(validated.executableSql);
        await client.query('COMMIT');

        const allRows = result.rows.map((row) => this.normalizeRow(row));
        const truncated = allRows.length > this.maxRows;
        const rows = truncated ? allRows.slice(0, this.maxRows) : allRows;

        return {
          sql: validated.originalSql,
          executableSql: validated.executableSql,
          columns: result.fields.map((field) => field.name),
          rows,
          rowCount: rows.length,
          truncated,
          referencedViews: validated.referencedViews,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        lastError = error;
        if (client) await this.safeRollback(client);
        this.logger.warn(
          JSON.stringify({
            type: 'ai_analytics_sql_failed',
            connection: target.label,
            willRetryWithFallback: index < this.pools.length - 1,
            message: error instanceof Error ? error.message : 'Unknown SQL error',
            durationMs: Date.now() - startedAt,
            referencedViews: validated.referencedViews,
          }),
        );
        if (index >= this.pools.length - 1) throw error;
      } finally {
        client?.release();
      }
    }

    throw lastError instanceof Error ? lastError : new Error('AI analytics SQL failed.');
  }

  private async beginReadOnly(client: PoolClient, userId: string) {
    await client.query('BEGIN READ ONLY');
    await client.query('SELECT set_config($1, $2, true)', [
      'app.current_user_id',
      userId,
    ]);
    await client.query('SELECT set_config($1, $2, true)', [
      'statement_timeout',
      `${this.timeoutMs}ms`,
    ]);
  }

  private async safeRollback(client: PoolClient) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // connection can already be closed after timeout; nothing useful to do here
    }
  }

  private normalizeRow(row: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, this.normalizeValue(value)]),
    );
  }

  private normalizeValue(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return value.toString();
    if (Buffer.isBuffer(value)) return '[binary data hidden]';
    if (typeof value === 'string' && value.length > 2000) {
      return `${value.slice(0, 2000)}…`;
    }
    return value;
  }

  private poolOptions(connectionString: string) {
    const databaseUrl = new URL(connectionString);
    const isSupabase =
      databaseUrl.hostname.endsWith('.supabase.com') ||
      databaseUrl.hostname.endsWith('.supabase.co');

    if (!isSupabase) return { connectionString, max: 3 };

    const certificateAuthority = readFileSync(
      join(process.cwd(), 'certs', 'supabase-prod-ca-2021.crt'),
      'utf8',
    );
    databaseUrl.searchParams.delete('sslmode');

    return {
      connectionString: databaseUrl.toString(),
      max: 3,
      ssl: {
        ca: certificateAuthority,
        rejectUnauthorized: true,
      },
    };
  }

  private poolTargets(
    analyticsConnectionString: string | null,
    appConnectionString: string | null,
  ): AnalyticsPoolTarget[] {
    const targets: AnalyticsPoolTarget[] = [];
    const seen = new Set<string>();

    if (analyticsConnectionString) {
      targets.push({
        label: 'AI_ANALYTICS_DATABASE_URL',
        pool: new Pool(this.poolOptions(analyticsConnectionString)),
      });
      seen.add(analyticsConnectionString);
    }

    if (appConnectionString && !seen.has(appConnectionString)) {
      targets.push({
        label: 'DATABASE_URL',
        pool: new Pool(this.poolOptions(appConnectionString)),
      });
    }

    return targets;
  }

  private numberFromConfig(
    value: string | undefined,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(parsed)));
  }
}
