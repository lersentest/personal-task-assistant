import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;
const ownerTelegramId = process.env.ALLOWED_TELEGRAM_USER_ID;
const publicWebUrl =
  process.env.PUBLIC_WEB_URL ||
  process.env.NEXT_PUBLIC_WEB_URL ||
  'https://personal-task-assistant-ruby.vercel.app';

if (!connectionString) throw new Error('DATABASE_URL is required');
if (!ownerTelegramId) throw new Error('ALLOWED_TELEGRAM_USER_ID is required');

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

function hashSecret(value) {
  return createHash('sha256').update(value).digest('hex');
}

const client = createClient();
const token = randomBytes(32).toString('base64url');
const tokenHash = hashSecret(token);
const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
const label = process.argv.slice(2).join(' ').trim() || 'external-audit';

try {
  await client.connect();
  const owner = await client.query(
    'SELECT id FROM users WHERE telegram_id = $1 LIMIT 1',
    [ownerTelegramId],
  );
  if (owner.rowCount !== 1) {
    throw new Error(`Owner with telegram_id=${ownerTelegramId} was not found`);
  }

  await client.query(
    `INSERT INTO audit_access_grants (owner_id, token_hash, label, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [owner.rows[0].id, tokenHash, label, expiresAt],
  );

  const baseUrl = publicWebUrl.replace(/\/$/, '');
  console.log(JSON.stringify({
    auditUrl: `${baseUrl}/audit-access/${token}`,
    auditIndexUrl: `${baseUrl}/audit-index`,
    expiresAt: expiresAt.toISOString(),
    label,
    tokenStoredAsHashOnly: true,
  }, null, 2));
} finally {
  await client.end();
}
