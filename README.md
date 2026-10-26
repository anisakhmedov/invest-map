# InvestMap

Интерактивная инвестиционная карта. Документация — в `docs/`, правила работы — в `CLAUDE.md`.

## Запуск
```bash
docker compose up -d                # PostGIS + RustFS (S3), нужен Docker
cd apps/web
cp .env.example .env
pnpm install
pnpm db:generate
pnpm exec prisma migrate deploy      # применить миграции
SEED_ADMIN_EMAIL=admin@investmap.local SEED_ADMIN_PASSWORD=<пароль от 10 символов, буквы и цифры> pnpm db:seed
pnpm db:seed:demo                   # (необязательно) ДЕМО-данные для карты: 3 региона, 15 объектов
pnpm dev                            # http://127.0.0.1:3000
```
Проверки: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test` (быстрые), `pnpm test:int` (нужны запущенные БД и S3).

Адреса: сайт `/uz`, `/oz`, `/ru`, `/en`; админка `/{язык}/admin`. В dev открывайте сайт по `127.0.0.1`.

Демо-данные карты придуманы и помечены «(демо)»: границы это простые шестиугольники вокруг городов. Настоящие данные вводятся через админку.

Ворркер MapLibre копируется в `apps/web/public/maplibre` скриптом при `pnpm install`, `pnpm dev` и `pnpm build`.

Редактор карты: `/{язык}/admin/map` (рисование, правка вершин, планы, импорт GeoJSON). Экспорт всех слоёв: `/api/map/export` (нужен вход).

Инвестиционная таблица: `/{язык}/admin/invest` (ручной ввод, импорт CSV с предпросмотром, экспорт `/api/invest/export`). Лоты аукциона: `/{язык}/admin/auction`. Публично: `/{язык}/projects` и `/{язык}/auction`. Время лотов хранится в UTC и показывается по Ташкенту (UTC+5).

Обращения: форма `/{язык}/request`, работа сотрудников `/{язык}/admin/requests`, задачи `/admin/tasks`, отчёты `/admin/reports`. Подробности и настройка почты — в `docs/05-requests.md`.

Развёртывание, домен, резервные копии и чек-лист передачи заказчику — в `docs/06-deployment.md` (файлы в `deploy/`).
