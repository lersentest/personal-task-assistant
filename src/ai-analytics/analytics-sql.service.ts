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

@Injectable()
export class AnalyticsSqlService implements OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsSqlService.name);
  private readonly pool: Pool | null;
  private readonly maxRows: number;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    const connectionString =
      config.get<string>('AI_ANALYTICS_DATABASE_URL')?.trim() ||
      config.get<string>('DATABASE_URL')?.trim();
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

    this.pool = connectionString
      ? new Pool(this.poolOptions(connectionString))
      : null;
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }

  async execute(userId: string, sql: string): Promise<AnalyticsSqlResult> {
    if (!this.pool) {
      throw new ServiceUnavailableException(
        'AI analytics database connection is not configured.',
      );
    }

    const validated = validateAnalyticsSql(sql, { maxRows: this.maxRows + 1 });
    const client = await this.pool.connect();
    const startedAt = Date.now();

    try {
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
      await this.safeRollback(client);
      this.logger.warn(
        JSON.stringify({
          type: 'ai_analytics_sql_failed',
          message: error instanceof Error ? error.message : 'Unknown SQL error',
          durationMs: Date.now() - startedAt,
          referencedViews: validated.referencedViews,
        }),
      );
      throw error;
    } finally {
      client.release();
    }
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
