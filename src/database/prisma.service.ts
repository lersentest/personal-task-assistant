import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '../generated/prisma/client';
import { addRequestTiming, getRequestId } from '../observability/request-context';

function createAdapter(connectionString: string): PrismaPg {
  const databaseUrl = new URL(connectionString);
  const isSupabase =
    databaseUrl.hostname.endsWith('.supabase.com') ||
    databaseUrl.hostname.endsWith('.supabase.co');

  if (!isSupabase) {
    return new PrismaPg({ connectionString });
  }

  const certificateAuthority = readFileSync(
    join(process.cwd(), 'certs', 'supabase-prod-ca-2021.crt'),
    'utf8',
  );

  // node-postgres lets sslmode in the URL replace an explicit ssl object.
  // Remove it so the trusted Supabase CA below is actually used.
  databaseUrl.searchParams.delete('sslmode');

  return new PrismaPg({
    connectionString: databaseUrl.toString(),
    ssl: {
      ca: certificateAuthority,
      rejectUnauthorized: true,
    },
  });
}

function numberFromConfig(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly slowQueryWarningMs: number;

  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');
    const slowQueryWarningMs = numberFromConfig(
      configService.get<string>('DB_SLOW_QUERY_WARNING_MS'),
      3000,
      0,
      60000,
    );
    const adapter = createAdapter(connectionString);
    super({ adapter, log: [{ emit: 'event', level: 'query' }] as const });
    this.slowQueryWarningMs = slowQueryWarningMs;

    const clientWithQueryEvents = this as unknown as {
      $on: (
        eventType: 'query',
        callback: (event: Prisma.QueryEvent) => void,
      ) => void;
    };

    clientWithQueryEvents.$on('query', (event) => {
      addRequestTiming('db', event.duration);
      if (
        this.slowQueryWarningMs <= 0 ||
        event.duration < this.slowQueryWarningMs
      ) {
        return;
      }
      this.logger.warn(
        JSON.stringify({
          type: 'db_slow_query',
          durationMs: event.duration,
          requestId: getRequestId(),
          timestamp: new Date().toISOString(),
        }),
      );
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
