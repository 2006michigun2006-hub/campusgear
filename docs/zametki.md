# Заметки по проекту CampusGear (для следующих сессий Claude)

Последнее обновление: 2026-11-09.

## Что это
- Исходник задания: `docs/CampusGear_Agile_Project_Plan_Part_1 (2).docx`, это Part 1 (Agile-план) итогового проекта по Project Management.
  Команда Barcelona / SE-2420, преподаватель Karina Smagulova.
- CampusGear — портал для краткосрочной выдачи техники в кампусе. Студенты бронируют технику, сотрудники выдачи выдают и принимают её.
- Пользователь попросил реализовать план и задеплоить на Render (база: "mongo или другая").

## Принятые решения (и почему)
- **БД: PostgreSQL**, не Mongo.
  - План сам называет Postgres кандидатом.
  - Цель G2 «ноль двойных броней» обеспечивается exclusion constraint (`btree_gist`, `tstzrange &&`).
  - Render даёт управляемый Postgres прямо в Blueprint.
- **Стек:** Node.js (ESM) + Express 5 + `pg`, фронт на React 18 + Vite.
  - Это один веб-сервис: Express отдаёт `dist/` и `/api`.
- **Аутентификация:** email + пароль (scrypt), сессии в таблице `sessions`, cookie `cg_session` (httpOnly, SameSite=Lax).
  - Это **отклонение от плана**: там single-use email link. Ссылкам нужен почтовый провайдер, его пока нет.
  - Самостоятельная регистрация создаёт только `student`. Аккаунт `staff` заводит сид из env `STAFF_EMAIL`/`STAFF_PASSWORD`.
- **CSRF:** все не-GET запросы к `/api` обязаны быть `application/json`, иначе ответ 415.
- **Часовой пояс кампуса:** `Asia/Almaty` по умолчанию (env `CAMPUS_TZ`). Даты хранятся в UTC, правила проверяются в зоне кампуса (`shared/time.js`).
- **Правила брони** (`shared/rules.js`, переопределяются env, см. `server/config.js`):
  - только будни, выдача с 9:00 до 16:00, возврат с 9:00 до 17:00, всё ровно по часам;
  - бронь на 1–14 дней вперёд (по календарным датам кампуса), длительность 1–72 часа.
- **Переходы статусов:** Confirmed → Checked out → Returned, либо Confirmed → Cancelled.
  - `planned_end_at` никогда не меняется.
  - Returned и Cancelled выпадают из constraint, поэтому их время освобождается.
- **Не больше одной активной брони на пару asset/student:** partial unique index.
- **US-11:** повтор запроса не создаёт дубль благодаря `idempotencyKey` (unique по account_id + key).
- **US-08:** при `unavailable` новые брони блокируются, а существующие помечаются флагом `assetUnavailable` и не удаляются. Checkout для них тоже заблокирован.
  - `unavailable_reason` видит только staff.
  - staff может явно отменить такую бронь.
- **Сид:** `server/seed.js` создаёт шесть синтетических предметов (3 laptop, 3 projector), staff и демо-студента.
  - У демо-студента есть история: возвращённая бронь, отменённая, просроченная и предстоящая.
  - Включается `SEED_DEMO` (по умолчанию да).
  - Пароли staff и студента при каждом старте берутся из env (upsert).

## Структура
- `server/`: `index.js` (migrate → seed → listen), `app.js`, `config.js`, `db.js`, `auth.js`, `migrate.js` (SQL-миграции + advisory lock), `migrations/001_init.sql`, `routes/*`, `serializers.js`, `seed.js`.
- `shared/`: общие для сервера и браузера `time.js` и `rules.js`.
- `client/`: фронт на React (Vite root = `client`, сборка в `dist/`).
- `test/`: тесты на `node:test` + supertest против реального Postgres.
  - `npm test` гоняет файлы последовательно, перед каждым файлом схема дропается.

## Локальная разработка
- Postgres в Docker: `docker run -d --name campusgear-pg -e POSTGRES_USER=campusgear -e POSTGRES_PASSWORD=campusgear -e POSTGRES_DB=campusgear -p 55432:5432 postgres:16-alpine`.
  - Плюс отдельная база `campusgear_test` для тестов.
  - DATABASE_URL по умолчанию: `postgres://campusgear:campusgear@localhost:55432/campusgear`.
- Демо-логины для dev: `staff@campusgear.test / staff-demo-pass`, `student@campusgear.test / student-demo-pass`.
- У пользователя нет `gh` CLI; Node 24, Docker, Git, Python 3.11 есть. Windows, PowerShell + Git Bash.

## Статус
- [x] Бэкенд, схема, сид
- [x] Тесты: 23/23 зелёные, включая G2 (20 конкурентных пар → 0 двойных броней)
  - Был баг с дедлоком 40P01 при параллельной вставке в exclusion constraint.
  - Решено: `withTransaction` в `server/db.js` повторяет транзакцию при 40P01/40001, на повторе она получает 23P01, и клиент видит 409.
- [x] Фронтенд (React): каталог, карточка с сеткой доступности, вход/регистрация, «Мои брони» (Active/History), Desk (очередь, выданные, просрочки, ассеты)
- [x] Проверено в headless Edge через CDP-скрипт (scratchpad, не в репо): мобильная ширина 390px без горизонтального скролла; полный сценарий студента и сотрудника работает.
- [x] render.yaml (Blueprint, регион frankfurt, free), CI `.github/workflows/ci.yml`, README.md, `.env.example`
- [x] git init (ветка main) + первый коммит
- [ ] Пользователь создаёт пустой репо на GitHub и даёт URL, после этого `git remote add origin … && git push -u origin main`
- [ ] На Render: New → Blueprint → репозиторий. Пароли staff и демо-студента лежат в Environment сервиса campusgear.
- [ ] После деплоя проверить `/api/health`, логин staff, бронирование.

## Дизайн фронта (требование пользователя, 2026-11-09)
- Пользователь хочет, чтобы фронт **не выглядел ИИ-шным** и был похож на настоящий университетский сайт AITU (Astana IT University).
- Правила:
  - шрифт Arial;
  - **никаких** скруглений, теней, градиентов, pill-чипов, эмодзи и «выпуклых» кнопок;
  - кнопки плоские и прямоугольные;
  - списки делаются таблицами (на телефоне они превращаются в блоки с подписями `data-label`).
- Цвета взяты из официального логотипа: navy `#001c46`, голубой `#1385e5`. Ссылки `#0a5bab`, чтобы хватало контраста.
- Логотипы скачаны с astanait.edu.kz и лежат в `client/public/`: `aitu-logo.svg` (цветной, ~360 КБ) и `aitu-logo-white.svg` (футер). Оба проверены, скриптов внутри нет.
- Каркас страницы: служебная полоса («Student pilot project · not an official AITU service») → шапка (логотип | Equipment Loan Service) → тёмно-синее меню КАПСОМ → серая полоса с хлебными крошками и H1 → контент → тёмно-синий футер (белый лого, реальный адрес AITU, колонки).
- Общие компоненты лежат в `client/src/components.jsx`: PageHeader, Tabs, StatusTag, Notice, Box. Есть страница правил `#/rules`.
- Дисклеймер «не официальный сервис AITU» оставлять обязательно: это студенческий проект на публичном URL.

## Идеи на потом (не сделано)
- Email single-use links (US-03 по плану) после выбора почтового провайдера.
- US-12 (waitlist) и US-13 (напоминания) отложены по плану.
- Админка для заведения новых ассетов (пока только сид).

## Нюансы Render (на что обратить внимание)
- Free Postgres на Render истекает примерно через 30 дней после создания, и на workspace даётся только один free-инстанс. Для долгой жизни нужен платный план или внешний Postgres (Neon) с `DATABASE_SSL=true`.
- Free web service засыпает после ~15 минут без трафика, первый запрос после этого идёт медленно.
- Build: `npm ci --include=dev && npm run build`, потому что при NODE_ENV=production devDeps (vite) иначе не ставятся.
