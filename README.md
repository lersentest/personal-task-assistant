# Personal Task Assistant

Личный Telegram-бот на NestJS, grammY, Prisma, PostgreSQL и OpenAI для управления проектами, задачами, тегами и напоминаниями.

## Возможности

- доступ только владельцу по Telegram ID;
- создание проектов и задач текстом или голосом;
- OpenAI Structured Outputs и распознавание русских, украинских и английских дат;
- обязательное подтверждение создания и текстового/голосового редактирования;
- разделы «Сегодня», «Просроченные», «Ближайшие» и «Все задачи»;
- карточки задач со статусом, приоритетом, проектом, тегами и сроком;
- редактирование свободной командой или кнопками;
- статусы `NEW`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`;
- приоритеты `LOW`, `NORMAL`, `HIGH`, `URGENT`;
- проекты, несколько тегов на задачу и фильтрация;
- напоминания, откладывание на час и повторные напоминания по просроченным задачам;
- ежедневная сводка в 07:00 по часовому поясу пользователя;
- мягкое удаление в корзину и восстановление;
- поиск по названию, описанию и проекту.

## Использование

Откройте Telegram-бота и отправьте `/start`. Можно использовать меню или писать обычными фразами:

```text
Создай задачу проверить оплату по проекту Dublin в пятницу, высокий приоритет, теги финансы и клиент.
```

```text
Перенеси задачу по оплате на следующий понедельник и поставь срочный приоритет.
```

Те же команды можно отправлять голосом. Перед записью в базу бот показывает карточку с кнопками `Подтвердить` и `Отменить`.

## Переменные окружения

```dotenv
TELEGRAM_BOT_TOKEN=replace_with_botfather_token
ALLOWED_TELEGRAM_USER_ID=123456789
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
APP_TIMEZONE=Europe/Zurich
OPENAI_API_KEY=replace_with_openai_api_key
OPENAI_TEXT_MODEL=gpt-5.4-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

Секреты хранятся только в `.env` или переменных Railway. `.env` исключён из Git.

## Локальный запуск

```powershell
Copy-Item .env.example .env
npm ci
npm run prisma:deploy
npm run start:dev
```

Нельзя одновременно запускать локальный и Railway-процесс с одним Telegram-токеном: Telegram long polling допускает только одного получателя updates.

## Проверки

```powershell
npm run typecheck
npm test
npm run db:smoke
npm run openai:smoke
npm run openai:audio-smoke
```

## Развёртывание

`railway.json` выполняет `npm ci`, сборку, Prisma-миграции, проверку базы и запуск приложения. Полная пошаговая инструкция находится в [DEPLOYMENT.md](./DEPLOYMENT.md).

## Архитектура

```text
src/
  ai/           # Structured Outputs и Speech-to-Text
  automation/   # напоминания и ежедневная сводка
  database/     # Prisma
  projects/     # проекты
  reminders/    # очередь уведомлений
  tags/         # теги
  tasks/        # задачи, выборки и изменения
  telegram/     # меню, карточки и обработчики
  users/        # владелец и часовой пояс
```
