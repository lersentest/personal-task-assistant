import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) throw new Error('DATABASE_URL is required');

function createClient() {
  const databaseUrl = new URL(connectionString);
  const isSupabase =
    databaseUrl.hostname.endsWith('.supabase.com') ||
    databaseUrl.hostname.endsWith('.supabase.co');
  const clientConfig = { connectionString };

  if (isSupabase) {
    databaseUrl.searchParams.delete('sslmode');
    clientConfig.connectionString = databaseUrl.toString();
    clientConfig.ssl = {
      ca: readFileSync(join(process.cwd(), 'certs', 'supabase-prod-ca-2021.crt'), 'utf8'),
      rejectUnauthorized: true,
    };
  }

  return new Client(clientConfig);
}

const client = createClient();

try {
  await client.connect();
  const now = new Date();
  const sessions = await client.query(
    'UPDATE audit_sessions SET revoked_at = $1 WHERE revoked_at IS NULL RETURNING id',
    [now],
  );
  const grants = await client.query(
    'UPDATE audit_access_grants SET revoked_at = $1 WHERE revoked_at IS NULL RETURNING id',
    [now],
  );
  console.log(JSON.stringify({
    revokedGrants: grants.rowCount,
    revokedSessions: sessions.rowCount,
    revokedAt: now.toISOString(),
  }, null, 2));
} finally {
  await client.end();
}
