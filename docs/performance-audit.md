# Performance audit

Дата: 2026-07-16

## Что заметно по текущей архитектуре

- Веб-клиент часто делает повторные запросы после действий пользователя, потому что часть мутаций инвалидирует весь TanStack Query cache.
- `supabase.auth.getSession()` вызывался перед каждым авторизованным API-запросом. Это безопасно, но добавляет лишнюю работу на каждый клик.
- Списочные экраны в нескольких местах получают подробные DTO с вложенными сущностями. Для больших списков это увеличивает время БД, сериализации и размер JSON.
- До этого этапа в продакшене не было единого `requestId`, `Server-Timing` и структурированных логов времени запроса, поэтому тяжело понять, где именно задержка: auth, DB, сервисная логика или сеть.

## Что внедрено в первом performance-этапе

- Backend:
  - `X-Request-Id` для каждого HTTP-запроса.
  - структурированный лог `api_request` без токенов, описаний задач, комментариев и файлов.
  - `Server-Timing` с сегментами `auth`, `db`, `service`, `serialization`, `total`.
  - замер auth guard.
  - Prisma query timing через query events, суммирование DB-времени по текущему request context.
  - slow query warning от 150 мс без SQL-параметров.

- Frontend:
  - короткий cache access token на клиенте до истечения Supabase session.
  - `X-Request-Id` в обычных, публичных, download и multipart-запросах.
  - performance marks: `app-navigation-start`, `auth-ready`, `initial-data-request-start`, `initial-data-request-end`, `page-content-rendered`.
  - увеличенный `staleTime`, `gcTime`, отключен refetch on window focus.
  - включено placeholder previous data на уровне TanStack Query.

## Следующие узкие места

1. Заменить глобальные `queryClient.invalidateQueries()` на точечные инвалидирования.
2. Разделить list/detail DTO для задач, делегированных задач, проектов, календаря и файлов.
3. Добавить/доработать агрегированные endpoints для списков, где сейчас экран собирается из нескольких запросов.
4. Проверить production deployment logs по `requestId` и `Server-Timing`, затем оптимизировать самые медленные запросы.
