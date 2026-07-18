# AI analytics chat

AI-чат работает через отдельный безопасный слой:

- история хранится в `ai_analytics_conversations` и `ai_analytics_messages`;
- модель получает доступ только к read-only представлениям `ai_analytics.*`;
- backend перед каждым SQL-запросом выставляет `app.current_user_id`, поэтому views отдают данные только текущего владельца;
- SQL-валидатор разрешает только один `SELECT` / `WITH ... SELECT`, блокирует мутации, системные схемы и опасные функции;
- бинарное содержимое файлов AI не получает — только метаданные вложений.

## Railway variables

Обязательная переменная для включения SQL-аналитики:

```env
AI_ANALYTICS_DATABASE_URL=postgresql://ai_analytics_reader:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
```

Опциональные настройки:

```env
AI_ANALYTICS_FAST_MODEL=
AI_ANALYTICS_SMART_MODEL=
AI_ANALYTICS_MAX_TOOL_CALLS=4
AI_ANALYTICS_MAX_RESULT_ROWS=100
AI_ANALYTICS_QUERY_TIMEOUT_MS=5000
```

Если `AI_ANALYTICS_FAST_MODEL` и `AI_ANALYTICS_SMART_MODEL` не заданы, используется `OPENAI_TEXT_MODEL`.

## Read-only role

Роль создаётся в Supabase SQL Editor вручную или отдельным admin-скриптом:

```sql
CREATE ROLE ai_analytics_reader LOGIN PASSWORD '<strong-password>';
ALTER ROLE ai_analytics_reader SET default_transaction_read_only = on;
GRANT CONNECT ON DATABASE postgres TO ai_analytics_reader;
GRANT USAGE ON SCHEMA ai_analytics TO ai_analytics_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA ai_analytics TO ai_analytics_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA ai_analytics
  GRANT SELECT ON TABLES TO ai_analytics_reader;
```

Если роль уже существует до деплоя миграции, миграция сама выдаст ей права на `ai_analytics`.
