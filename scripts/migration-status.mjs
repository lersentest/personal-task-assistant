import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const databaseUrl = new URL(process.env.DATABASE_URL);
const config = { connectionString: databaseUrl.toString() };
if (
  databaseUrl.hostname.endsWith('.supabase.com') ||
  databaseUrl.hostname.endsWith('.supabase.co')
) {
  databaseUrl.searchParams.delete('sslmode');
  config.connectionString = databaseUrl.toString();
  config.ssl = {
    ca: readFileSync(
      join(process.cwd(), 'certs', 'supabase-prod-ca-2021.crt'),
      'utf8',
    ),
    rejectUnauthorized: true,
  };
}

const client = new pg.Client(config);
await client.connect();
try {
  const migrations = await client.query(
    'SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM _prisma_migrations ORDER BY started_at',
  );
  const tables = await client.query(
    "SELECT to_regclass('public.tags') IS NOT NULL AS tags, to_regclass('public.reminders') IS NOT NULL AS reminders, to_regclass('public.daily_summary_deliveries') IS NOT NULL AS summaries",
  );
  console.log(JSON.stringify({ migrations: migrations.rows, tables: tables.rows[0] }));
} finally {
  await client.end();
}
