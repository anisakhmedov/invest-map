# Архитектура (предложение)

## Стек

| Слой | Выбор | Почему |
|------|-------|--------|
| Фронтенд | Next.js (App Router) + TypeScript + Tailwind | SSR/SEO, мультиязычные маршруты, один репозиторий |
| Карта | MapLibre GL JS + (Terra Draw для рисования) | Векторные слои, GeoJSON, без лицензий Google |
| API | Next.js Route Handlers / Server Actions + Zod | Типобезопасно, меньше инфраструктуры |
| БД | PostgreSQL + PostGIS | Геометрия районов, участков, дорог |
| ORM | Prisma 6 (+ raw SQL для PostGIS); Prisma 7 CLI в этой среде несовместим с классическим workflow | Миграции, типы |
| Auth | Auth.js (сессии, bcrypt/argon2), RBAC на сервере | Роли и права |
| Файлы | S3-совместимое хранилище (MinIO / R2) | Медиабиблиотека, планы |
| i18n | Нативный i18n Next.js 16 (`proxy.ts` + `[lang]` + `next/root-params` + JSON-словари; uz, oz=uz-Cyrl, ru, en) | Без доп. зависимостей, совместимо с Cache Components |
| Тесты | Vitest + Playwright | Юнит + e2e карты и форм |
| Деплой | Docker Compose (app + postgres/postgis + minio + nginx) | Переносимо на любой хостинг |

## Структура репозитория

```
InvestMap/
├─ docs/                 документация (ТЗ, модули, дизайн, API)
├─ apps/web/             Next.js (портал + админка)
│  ├─ src/app/[locale]/  публичные страницы
│  ├─ src/app/admin/     админ-панель
│  ├─ src/features/      map, regions, invest, auction, requests, users, cms
│  ├─ src/components/    UI-кит
│  └─ src/lib/           db, auth, i18n, rbac, audit
├─ prisma/               схема и миграции
├─ docker/               compose, nginx
└─ CLAUDE.md             правила работы Claude над проектом
```

## Ключевые сущности БД

`User, Role, Permission, AuditLog` · `Page, Block, MediaAsset, SiteSetting, Translation`
`Region(geom), Layer, MapFeature(geom, props), Road, Stop, PlanOverlay(image, bounds)`
`InvestObject, InvestTableRow, Auction, AuctionLot` · `Request, RequestMessage, Task, Report`

Все пользовательские тексты — через таблицу переводов/JSON-поля `{uz, uzc, ru, en}`.

## Принципы

- RBAC проверяется на сервере в каждом handler; UI только скрывает.
- Каждое изменение данных пишет запись в `AuditLog` (кто, что, было/стало).
- Геоданные: хранение в PostGIS (SRID 4326), отдача как GeoJSON/vector tiles.
- Редактор карты и публичная карта делят одни и те же слои.
