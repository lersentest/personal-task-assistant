export interface AppEnvironment {
  TELEGRAM_BOT_TOKEN: string;
  ALLOWED_TELEGRAM_USER_ID: string;
  DATABASE_URL: string;
  APP_TIMEZONE: string;
  OPENAI_API_KEY: string;
  OPENAI_TEXT_MODEL: string;
  OPENAI_TRANSCRIPTION_MODEL: string;
  PORT: string;
  FRONTEND_ORIGINS: string;
  SUPABASE_URL: string;
  SUPABASE_JWT_SECRET: string;
}

const REQUIRED_KEYS = [
  'TELEGRAM_BOT_TOKEN',
  'ALLOWED_TELEGRAM_USER_ID',
  'DATABASE_URL',
  'OPENAI_API_KEY',
] as const;

export function validateEnvironment(
  values: Record<string, unknown>,
): Record<string, unknown> & AppEnvironment {
  for (const key of REQUIRED_KEYS) {
    if (typeof values[key] !== 'string' || values[key].trim().length === 0) {
      throw new Error(`Environment variable ${key} is required`);
    }
  }

  const telegramUserId = String(values.ALLOWED_TELEGRAM_USER_ID);
  if (!/^\d+$/.test(telegramUserId)) {
    throw new Error('ALLOWED_TELEGRAM_USER_ID must contain digits only');
  }

  const databaseUrl = String(values.DATABASE_URL);
  if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
  }

  return {
    ...values,
    TELEGRAM_BOT_TOKEN: String(values.TELEGRAM_BOT_TOKEN),
    ALLOWED_TELEGRAM_USER_ID: telegramUserId,
    DATABASE_URL: databaseUrl,
    OPENAI_API_KEY: String(values.OPENAI_API_KEY),
    APP_TIMEZONE:
      typeof values.APP_TIMEZONE === 'string' && values.APP_TIMEZONE.trim()
        ? values.APP_TIMEZONE
        : 'Europe/Zurich',
    OPENAI_TEXT_MODEL:
      typeof values.OPENAI_TEXT_MODEL === 'string' &&
      values.OPENAI_TEXT_MODEL.trim()
        ? values.OPENAI_TEXT_MODEL
        : 'gpt-5.4-mini',
    OPENAI_TRANSCRIPTION_MODEL:
      typeof values.OPENAI_TRANSCRIPTION_MODEL === 'string' &&
      values.OPENAI_TRANSCRIPTION_MODEL.trim()
        ? values.OPENAI_TRANSCRIPTION_MODEL
        : 'gpt-4o-mini-transcribe',
    PORT:
      typeof values.PORT === 'string' && values.PORT.trim()
        ? values.PORT
        : '3000',
    FRONTEND_ORIGINS:
      typeof values.FRONTEND_ORIGINS === 'string' &&
      values.FRONTEND_ORIGINS.trim()
        ? values.FRONTEND_ORIGINS
        : 'http://localhost:3001,http://localhost:3000',
    SUPABASE_URL:
      typeof values.SUPABASE_URL === 'string' && values.SUPABASE_URL.trim()
        ? values.SUPABASE_URL
        : '',
    SUPABASE_JWT_SECRET:
      typeof values.SUPABASE_JWT_SECRET === 'string' &&
      values.SUPABASE_JWT_SECRET.trim()
        ? values.SUPABASE_JWT_SECRET
        : '',
  } as Record<string, unknown> & AppEnvironment;
}
