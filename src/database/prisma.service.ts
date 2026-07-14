import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '../generated/prisma/client';

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

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');
    const adapter = createAdapter(connectionString);
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
