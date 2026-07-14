# Настройка, запуск и эксплуатация

## Что уже настроено

Продакшен уже развернут и работает:

- Railway-проект: `personal-task-assistant`;
- Railway-сервис: `telegram-bot`;
- окружение: `production`;
- база PostgreSQL: Supabase, проект `lersentest Project`;
- Prisma-миграции `20260714000000_init` и `20260714013000_tags_reminders_summaries` применены;
- Telegram-бот: `@david_personal_task_bot`;
- доступ разрешен только Telegram ID, заданному в `ALLOWED_TELEGRAM_USER_ID`;
- часовой пояс: `Europe/Zurich`;
- получение Telegram-сообщений: long polling, отдельный HTTP-домен не нужен;
- OpenAI: Structured Outputs и Speech-to-Text;
- ежедневная сводка: 07:00 по часовому поясу пользователя.

Полезные ссылки:

- [Railway](https://railway.com/project/93a003ad-5c8b-4e3e-abb6-3b696d6daf18?environmentId=70fbbfda-e420-40fb-85e3-b6362f354f47)
- [Supabase](https://supabase.com/dashboard/project/kssozqktrrsufskkdzlq)
- [Telegram-бот](https://t.me/david_personal_task_bot)

## Как начать пользоваться прямо сейчас

1. Откройте `@david_personal_task_bot` в Telegram.
2. Нажмите **Start** или отправьте `/start`.
3. Для повторного открытия меню отправьте `/menu`.
4. Нажмите `Новый проект` и отправьте название, например:

   ```text
   Villa Geneva | Ремонт виллы
   ```

5. Проверьте карточку и нажмите `Подтвердить`. До подтверждения запись в базу не создается.
6. Нажмите `Новая задача` и отправьте, например:

   ```text
   Проверить оплату по проекту Villa Geneva в пятницу, высокий приоритет, тег финансы
   ```

7. Еще раз проверьте карточку и подтвердите создание.

Также можно отправить ту же команду голосом. В меню доступны просмотр задач, проекты, теги и поиск. В карточке задачи находятся кнопки статуса, приоритета, редактирования, напоминания и корзины.

## Как проверить состояние в Railway

1. Откройте ссылку Railway выше.
2. Карточка `telegram-bot` должна иметь состояние **Online**.
3. Откройте сервис и вкладку **Deployments**.
4. Последнее развертывание должно иметь состояние **Success**.
5. Откройте логи. После запуска должны присутствовать строки:

   ```text
   Starting Nest application...
   Telegram bot @david_personal_task_bot started
   ```

Не публикуйте полный экспорт логов, если в будущем в приложение будет добавлено логирование пользовательских документов.

## Переменные Railway

В `telegram-bot` → **Variables** уже сохранены:

```text
TELEGRAM_BOT_TOKEN
ALLOWED_TELEGRAM_USER_ID
DATABASE_URL
APP_TIMEZONE
OPENAI_API_KEY
OPENAI_TEXT_MODEL
OPENAI_TRANSCRIPTION_MODEL
```

Значения токена и пароля базы намеренно не приведены в документации.

Чтобы изменить переменную:

1. Откройте `telegram-bot` → **Variables**.
2. У нужной переменной откройте меню `⋮` → **Edit**.
3. Введите новое значение и нажмите **Submit**.
4. В верхней панели появится `Apply 1 change`.
5. Нажмите **Deploy**.
6. Дождитесь состояния **Success** и проверьте логи.

## Обновление кода в Railway без GitHub

Текущий продакшен загружен напрямую через Railway CLI. Это позволяет работать без локального PostgreSQL и без GitHub-репозитория.

На компьютере с Node.js и Railway CLI:

```powershell
npm install -g @railway/cli
railway login
```

Перейдите в каталог проекта и свяжите его с уже созданным продакшеном:

```powershell
railway link -p 93a003ad-5c8b-4e3e-abb6-3b696d6daf18 -e production
railway service link telegram-bot
```

Проверьте связь и загрузите новую версию:

```powershell
railway status
railway up --detach --message "Описание изменения"
```

Конфигурация `railway.json` автоматически выполняет:

1. `npm ci && npm run build`;
2. `npm run prisma:deploy` до запуска новой версии;
3. `npm run db:smoke` для контрольного запроса `SELECT 1`;
4. `npm start` только после успешной миграции и проверки подключения.

Статус и логи из терминала:

```powershell
railway service status --json
railway deployment list --json
railway logs --lines 100
```

## Локальный запуск

Локальный запуск не требуется для работы продакшена. Он нужен только для разработки.

### 1. Требования

- Node.js 24 LTS (минимум `22.12.0`);
- npm;
- PostgreSQL или строка подключения к отдельной тестовой базе;
- токен Telegram-бота;
- Telegram ID владельца.
- OpenAI API-ключ с доступом к Responses API и Audio Transcriptions.

### 2. Установка

```powershell
Copy-Item .env.example .env
npm ci
```

Заполните `.env`:

```dotenv
TELEGRAM_BOT_TOKEN=полученный_в_BotFather_токен
ALLOWED_TELEGRAM_USER_ID=ваш_числовой_Telegram_ID
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
APP_TIMEZONE=Europe/Zurich
OPENAI_API_KEY=ваш_OpenAI_API_ключ
OPENAI_TEXT_MODEL=gpt-5.4-mini
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
```

### 3. База и запуск

Для чистой тестовой базы:

```powershell
npm run prisma:deploy
npm run start:dev
```

Проверки перед запуском:

```powershell
npm run typecheck
npm test
```

Важно: один Telegram-токен не должен одновременно использоваться двумя long-polling процессами. Перед локальным запуском остановите Railway-сервис или используйте отдельного тестового бота.

## Работа с Supabase

Схема создается Prisma-миграциями. Для продакшена используйте только:

```powershell
npm run prisma:deploy
```

`prisma migrate dev` предназначен для создания новых миграций в локальной среде, а не для продакшена.

Если вы сбросили пароль базы в Supabase:

1. Откройте **Project Settings** → **Database** → **Reset database password**.
2. Сформируйте новую session-pooler строку подключения на порту `5432`.
3. URL-кодируйте специальные символы пароля.
4. Обновите `DATABASE_URL` в Railway.
5. Нажмите **Deploy** и проверьте применение миграций.

Старое подключение перестанет работать сразу после сброса пароля.

## Перезапуск и остановка

Для обычного перезапуска откройте последнее успешное развертывание Railway и выберите **Restart**. Переменные и код при этом не меняются.

Остановка сервиса отключит Telegram-бота, но не удалит данные Supabase. Не используйте **Delete service** или удаление Supabase-проекта для временной остановки.

## Безопасность

- `.env` исключен через `.gitignore`;
- секреты не входят в ZIP и исходный код;
- Railway показывает секретные значения маской;
- не отправляйте токен или `DATABASE_URL` в сообщения, коммиты, скриншоты и логи;
- если Telegram-токен скомпрометирован, отзовите его в BotFather, сохраните новый токен в Railway и выполните Deploy;
- при подозрении на утечку пароля Supabase сбросьте пароль и обновите `DATABASE_URL`;
- доступ к боту дополнительно ограничен числовым Telegram ID владельца.

## Оплата и непрерывная работа

Railway сейчас работает в пробном режиме. В интерфейсе отображается лимит **30 дней или $5**, после исчерпания которого сервис может остановиться. Чтобы бот продолжал работать постоянно, заранее подключите подходящий тариф Railway и контролируйте вкладку **Usage**.

Supabase также следует контролировать по лимитам бесплатного проекта, числу подключений и доступному диску.

OpenAI API работает по отдельному балансу. На момент развёртывания Structured Outputs и Speech-to-Text проверены реальными тестовыми запросами. Контролируйте **Usage** и **Credit balance** в OpenAI Platform; при нулевом балансе текстовые AI-команды и голос временно перестанут работать, но кнопки и обычный просмотр сохранённых задач останутся доступны.

## Частые проблемы

### Бот не отвечает

1. Убедитесь, что сервис Railway имеет состояние **Online**.
2. Проверьте последние логи.
3. Убедитесь, что Telegram ID совпадает с `ALLOWED_TELEGRAM_USER_ID`.
4. Проверьте, что этот же токен не запущен локально во втором процессе.
5. При ошибке авторизации Telegram обновите токен из BotFather.

### Ошибка Prisma `P1000`

Неверны пользователь или пароль в `DATABASE_URL`. Скопируйте актуальную session-pooler строку Supabase, обновите Railway-переменную и примените изменение через **Deploy**.

### Сборка прошла, но сервис не стартует

Откройте deployment logs. Ошибка до строки `npm start` обычно относится к миграции; ошибка после нее — к конфигурации или Telegram.

### Изменения переменных не применились

После **Submit** обязательно нажмите верхнюю кнопку **Deploy** и дождитесь состояния **Success**.
