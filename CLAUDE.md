# InvestMap

Интерактивная инвестиционная карта (портал + админка + кабинет). Документация: `docs/01-TZ.md`, `docs/02-architecture.md`, `docs/03-roadmap.md`, `docs/modules/*`.

## Правила
- Язык общения с владельцем: русский. Тексты интерфейса: uz (lat) основной, плюс uz-Cyrl, ru, en — никаких захардкоженных строк, только ключи i18n.
- Стек: Next.js + TypeScript + Tailwind, PostgreSQL/PostGIS, Prisma, MapLibre, next-intl, Vitest/Playwright.
- RBAC проверять на сервере; каждое изменение данных пишет AuditLog.
- Геоданные — SRID 4326, GeoJSON валидировать на входе.
- Mobile-first, WCAG 2.2 AA, светлая и тёмная темы через дизайн-токены.
- Перед закрытием этапа: тесты, `/code-review`, для auth/загрузок — `/security-review`.

## Какие skills когда использовать
| Задача | Skill |
|--------|-------|
| Визуальное направление, новые экраны | `frontend-design` |
| Реализация по макету Figma/картинке | `build-design`, `figma:figma-design-to-code` |
| Палитра, токены, контраст (светлая/тёмная) | `better-colors` |
| Сетка, адаптив, длинные переводы, RTL-стойкость | `better-layout` |
| Шрифты (кириллица/латиница uz), шкала | `better-typography` |
| Доступность, формы, фокус, ARIA | `better-accessibility` |
| Тексты кнопок/ошибок/пустых состояний | `better-writing` |
| Радиусы, тени, иконки, анимации | `better-ui` |
| Общий UI-аудит экрана | `better-interface` |
| Графики отчётов и дашборд | `dataviz` |
| Запуск и проверка приложения | `run` |
| Ревью / безопасность | `code-review`, `security-review`, `simplify` |
| Обновление этого файла | `init` |
| Проверка в браузере | `anthropic-skills:built-in-browser` |
