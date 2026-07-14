import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const databaseUrl = new URL(connectionString);
const isSupabase =
  databaseUrl.hostname.endsWith('.supabase.com') ||
  databaseUrl.hostname.endsWith('.supabase.co');
const clientConfig = { connectionString };

if (isSupabase) {
  databaseUrl.searchParams.delete('sslmode');
  clientConfig.connectionString = databaseUrl.toString();
  clientConfig.ssl = {
    ca: readFileSync(
      join(process.cwd(), 'certs', 'supabase-prod-ca-2021.crt'),
      'utf8',
    ),
    rejectUnauthorized: true,
  };
}

const client = new Client(clientConfig);

try {
  await client.connect();
  await client.query('SELECT 1');
  console.log('Database connection verified');
} finally {
  await client.end();
}
