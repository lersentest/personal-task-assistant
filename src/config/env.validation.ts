export interface AppEnvironment {
  TELEGRAM_BOT_TOKEN: string;
  ALLOWED_TELEGRAM_USER_ID: string;
  DATABASE_URL: string;
  APP_TIMEZONE: string;
  OPENAI_API_KEY: string;
  OPENAI_TEXT_MODEL: string;
  OPENAI_TRANSCRIPTION_MODEL: string;
  AI_ANALYTICS_DATABASE_URL: string;
  AI_ANALYTICS_FAST_MODEL: string;
  AI_ANALYTICS_SMART_MODEL: string;
  AI_ANALYTICS_MAX_TOOL_CALLS: string;
  AI_ANALYTICS_MAX_RESULT_ROWS: string;
  AI_ANALYTICS_QUERY_TIMEOUT_MS: string;
  AI_ANALYTICS_INPUT_PRICE_PER_1M_USD: string;
  AI_ANALYTICS_CACHED_INPUT_PRICE_PER_1M_USD: string;
  AI_ANALYTICS_OUTPUT_PRICE_PER_1M_USD: string;
  DB_SLOW_QUERY_WARNING_MS: string;
  PORT: string;
  FRONTEND_ORIGINS: string;
  PUBLIC_WEB_URL: string;
  SUPABASE_URL: string;
  SUPABASE_JWT_SECRET: string;
  AUDIT_ACCESS_ENABLED: string;
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
    AI_ANALYTICS_DATABASE_URL:
      typeof values.AI_ANALYTICS_DATABASE_URL === 'string' &&
      values.AI_ANALYTICS_DATABASE_URL.trim()
        ? values.AI_ANALYTICS_DATABASE_URL
        : '',
    AI_ANALYTICS_FAST_MODEL:
      typeof values.AI_ANALYTICS_FAST_MODEL === 'string' &&
      values.AI_ANALYTICS_FAST_MODEL.trim()
        ? values.AI_ANALYTICS_FAST_MODEL
        : '',
    AI_ANALYTICS_SMART_MODEL:
      typeof values.AI_ANALYTICS_SMART_MODEL === 'string' &&
      values.AI_ANALYTICS_SMART_MODEL.trim()
        ? values.AI_ANALYTICS_SMART_MODEL
        : '',
    AI_ANALYTICS_MAX_TOOL_CALLS:
      typeof values.AI_ANALYTICS_MAX_TOOL_CALLS === 'string' &&
      values.AI_ANALYTICS_MAX_TOOL_CALLS.trim()
        ? values.AI_ANALYTICS_MAX_TOOL_CALLS
        : '4',
    AI_ANALYTICS_MAX_RESULT_ROWS:
      typeof values.AI_ANALYTICS_MAX_RESULT_ROWS === 'string' &&
      values.AI_ANALYTICS_MAX_RESULT_ROWS.trim()
        ? values.AI_ANALYTICS_MAX_RESULT_ROWS
        : '100',
    AI_ANALYTICS_QUERY_TIMEOUT_MS:
      typeof values.AI_ANALYTICS_QUERY_TIMEOUT_MS === 'string' &&
      values.AI_ANALYTICS_QUERY_TIMEOUT_MS.trim()
        ? values.AI_ANALYTICS_QUERY_TIMEOUT_MS
        : '5000',
    AI_ANALYTICS_INPUT_PRICE_PER_1M_USD:
      typeof values.AI_ANALYTICS_INPUT_PRICE_PER_1M_USD === 'string' &&
      values.AI_ANALYTICS_INPUT_PRICE_PER_1M_USD.trim()
        ? values.AI_ANALYTICS_INPUT_PRICE_PER_1M_USD
        : '',
    AI_ANALYTICS_CACHED_INPUT_PRICE_PER_1M_USD:
      typeof values.AI_ANALYTICS_CACHED_INPUT_PRICE_PER_1M_USD === 'string' &&
      values.AI_ANALYTICS_CACHED_INPUT_PRICE_PER_1M_USD.trim()
        ? values.AI_ANALYTICS_CACHED_INPUT_PRICE_PER_1M_USD
        : '',
    AI_ANALYTICS_OUTPUT_PRICE_PER_1M_USD:
      typeof values.AI_ANALYTICS_OUTPUT_PRICE_PER_1M_USD === 'string' &&
      values.AI_ANALYTICS_OUTPUT_PRICE_PER_1M_USD.trim()
        ? values.AI_ANALYTICS_OUTPUT_PRICE_PER_1M_USD
        : '',
    DB_SLOW_QUERY_WARNING_MS:
      typeof values.DB_SLOW_QUERY_WARNING_MS === 'string' &&
      values.DB_SLOW_QUERY_WARNING_MS.trim()
        ? values.DB_SLOW_QUERY_WARNING_MS
        : '3000',
    PORT:
      typeof values.PORT === 'string' && values.PORT.trim()
        ? values.PORT
        : '3000',
    FRONTEND_ORIGINS:
      typeof values.FRONTEND_ORIGINS === 'string' &&
      values.FRONTEND_ORIGINS.trim()
        ? values.FRONTEND_ORIGINS
        : 'http://localhost:3001,http://localhost:3000',
    PUBLIC_WEB_URL:
      typeof values.PUBLIC_WEB_URL === 'string' && values.PUBLIC_WEB_URL.trim()
        ? values.PUBLIC_WEB_URL
        : '',
    SUPABASE_URL:
      typeof values.SUPABASE_URL === 'string' && values.SUPABASE_URL.trim()
        ? values.SUPABASE_URL
        : '',
    SUPABASE_JWT_SECRET:
      typeof values.SUPABASE_JWT_SECRET === 'string' &&
      values.SUPABASE_JWT_SECRET.trim()
        ? values.SUPABASE_JWT_SECRET
        : '',
    AUDIT_ACCESS_ENABLED:
      typeof values.AUDIT_ACCESS_ENABLED === 'string' &&
      values.AUDIT_ACCESS_ENABLED.trim()
        ? values.AUDIT_ACCESS_ENABLED
        : 'true',
  } as Record<string, unknown> & AppEnvironment;
}
