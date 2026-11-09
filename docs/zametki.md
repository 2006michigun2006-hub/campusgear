# Заметки по проекту CampusGear (для следующих сессий Claude)

Последнее обновление: 2026-11-09 (релиз 0.2.0).

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
- **Аутентификация (US-03, с 0.2.0 по плану):** основной способ — одноразовая ссылка на email, пароль (scrypt) оставлен как запасной.
  - Ссылка: таблица `login_links` (миграция 002), хранится только sha256, живёт 15 мин (`SIGNIN_LINK_MINUTES`), используется один раз (атомарный UPDATE), новая ссылка удаляет старые неиспользованные.
  - Токен лежит во фрагменте `/#/signin/<token>`, поэтому не попадает в логи. Вход только по кнопке Continue (POST `/api/auth/link/verify`), чтобы почтовые сканеры не «сжигали» ссылку.
  - Ответ на `POST /api/auth/link` одинаковый для известных и неизвестных адресов. Вне production в ответе есть `devLink`, страница входа его показывает.
  - Доставка: при `RESEND_API_KEY` через Resend (`server/mail.js`), иначе при `LOG_SIGNIN_LINKS=true` ссылка пишется в лог. На Render это включено в render.yaml (только для синтетики, открытый пункт в ASVS-чек-листе).
  - Базовый URL ссылки: `PUBLIC_URL` → `RENDER_EXTERNAL_URL` → в dev Host запроса (защита от подмены Host в prod).
  - Сессии в таблице `sessions`, cookie `cg_session` (httpOnly, SameSite=Lax). При любом входе старая сессия из cookie удаляется.
  - Самостоятельная регистрация создаёт только `student`. Аккаунт `staff` заводит сид из env `STAFF_EMAIL`/`STAFF_PASSWORD`.
- **Журнал запросов (S3-11):** `server/requestLog.js`, одна JSON-строка на запрос к `/api`: путь без query, статус, ms, код ошибки, id аккаунта. Без email, cookie и токенов. `/api/health` не логируется. Заголовок `X-Request-Id`. В тестах выключен (`LOG_REQUESTS`).
- **Хранение данных (E-07):** `server/housekeeping.js` раз в час удаляет истёкшие сессии и ссылки. История удаляется только если задан `HISTORY_RETENTION_DAYS` (по умолчанию 0, правило TBD).
- **Сброс демо:** `server/reset-demo.js` (`npm run demo:reset -- --yes`, `make demo-reset`): TRUNCATE броней/аккаунтов/сессий/ссылок, все ассеты снова available, затем seed.
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
- **Основной способ — `Makefile`:** `make dev` (http://localhost:5173), `make prod` (http://localhost:3000), `make test`, `make db` / `db-stop` / `db-reset` / `db-status`, `make clean`.
  - У пользователя GNU Make 4.4.1 (ezwinports через winget). Запускает из PowerShell, где make выполняет рецепты через cmd.exe, поэтому в рецептах **только вызовы node/npm**, без sh-синтаксиса.
  - Логика вынесена в `scripts/db.mjs` (Docker-контейнер `campusgear-pg`, ожидание pg_isready, создание `campusgear_test`) и `scripts/dev.mjs` (API `node --watch` + Vite с префиксами логов; если падает один процесс, гасится и второй).
  - `prod` экспортирует NODE_ENV=production и это наследуется зависимостями, поэтому установка идёт с `npm install --include=dev`, иначе не будет Vite.
  - Проверено: make prod и make dev из PowerShell, make test из bash.
- Postgres в Docker: `docker run -d --name campusgear-pg -e POSTGRES_USER=campusgear -e POSTGRES_PASSWORD=campusgear -e POSTGRES_DB=campusgear -p 55432:5432 postgres:16-alpine`.
  - Плюс отдельная база `campusgear_test` для тестов.
  - DATABASE_URL по умолчанию: `postgres://campusgear:campusgear@localhost:55432/campusgear`.
- Демо-логины для dev: `staff@campusgear.test / staff-demo-pass`, `student@campusgear.test / student-demo-pass`.
- У пользователя нет `gh` CLI; Node 24, Docker, Git, Python 3.11 есть. Windows, PowerShell + Git Bash.

## Статус
- [x] Бэкенд, схема, сид
- [x] Тесты: 34/34 зелёные (было 23 в 0.1.0), включая G2 (20 конкурентных пар → 0 двойных броней). Лог прогона лежит в `docs/evidence/test-log.txt`; перегенерировать командой из шапки файла.
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
- **Вторая итерация (по скриншотам пользователя):** первый вариант всё ещё выглядел «ИИ-шно». Пользователь назвал конкретно таблицы и шрифт, а также кривое выравнивание на странице входа. Что поменяли:
  - Таблицы теперь классические: сетка 1px `#d4d4d4`, светло-серая шапка `#f2f2f2`. Убраны navy-плашки в шапках таблиц, затенённая колонка с жирными подписями и толстые линии под заголовками.
  - Шрифт Arial 14px, H1 24px **обычного** веса, жирный используется минимально. Меню без капса, активный пункт белый.
  - Вкладки сделаны как «папки», бокс «Reservation» и сайдбар — с серым заголовком. Статусы показываются цветным текстом, без рамок.
  - Убраны длинные тире «—» и стрелки «→» (явный ИИ-признак) и пометка «Synthetic record.» в описаниях.
  - Предметы получили реалистичные модели: Lenovo ThinkPad E14 Gen 5, HP ProBook 450 G10, MacBook Air M2, Epson EB-E01, BenQ MW560, XGIMI MoGo 2. Сид делает upsert полей предметов.
  - Баг выравнивания: `.narrow` сбрасывал `margin-left` у `.container`. Теперь ширину ограничивают только дети (`.narrow > *`).

## Документы по плану (добавлены в 0.2.0, 2026-11-09)
- Оглавление в `docs/README.md`. Документы на английском, потому что это материалы для команды и преподавателя.
  - Журналы: `rule-log.md`, `decision-log.md` (D-01…D-12).
  - Процесс и данные: `privacy-and-retention.md`, `staff-guide.md`, `backlog.md` (статусы и трассировка story → тесты), `scrum-records.md`, `release-notes.md`.
  - Чек-листы: `checklists/accessibility-wcag22.md` и `checklists/security-asvs-nist.md`.
  - Пилот: `pilot/` (интервью, протокол, листы задач).
- Корень: `CONTRIBUTING.md` (DoD, ветки, доска); шаблоны в `.github/` (PR, issue: story, task, bug).
- **Честность:** нигде не выдумывать проведённые интервью, ревью, одобрения или пилот. Пустые таблицы так и остаются пустыми. Все правила Provisional/TBD, G3/G4 unverified. Статус историй «Built», а не «Done»: нет PR-ревью и Sprint Review.
- Проверка доступности: axe-core 4.10.2 через CDP в headless Edge (скрипт `axe-e2e.mjs` в scratchpad, не в репо). На 15 экранах 0 нарушений WCAG 2.2 A/AA, ширина 390 без горизонтального скролла.
- Известные пробелы, записанные в чек-листах:
  - пароль минимум 8 символов (NIST для однофакторного требует 15);
  - нет проверки по утёкшим паролям и таймаута неактивности;
  - каждая ячейка таймтейбла — отдельная Tab-остановка.
- Таймтейбл: часы одной брони сливаются в одну ячейку (colspan) с подписью. Своя бронь подписана именем и выделена голубым. Staff видит имя заёмщика. Аноним и другие студенты видят только «Booked»: `/api/assets/:id` отдаёт `name` только владельцу и staff (есть тест). Сделано по просьбе пользователя «пометки именем вместо серых квадратов», имена чужим не показываем из-за приватности.
- Staff теперь видит «Cancel booking» и для броней с прошедшим временем выдачи (no-show), не только для отозванных предметов.

## Сверка с планом Part 1 (2026-11-09, до 0.2.0)
- **Сделано по плану:** US-01, US-02, US-04…US-11 (с тестами), E-02 (CI, сброс демо), E-03, секреты (E-04), G2 (тест 20 пар).
- **Расходится с планом:**
  - US-03: пароль вместо single-use email link;
  - нет hosted sign-in;
  - тестовые предметы названы реальными моделями, хотя S1-05 требовал «clearly synthetic».
- **Нет в репо (документы из плана, раздел 5):**
  - rule log (E-01);
  - staff guide (E-06);
  - decision log (E-04);
  - политика хранения данных (E-07);
  - чек-листы WCAG 2.2, OWASP ASVS, NIST;
  - test protocol и task sheets для пилота (E-08);
  - release notes.
- **Нет request logging** в демо (S3-11).
- **Нужен GitHub или команда:** Issues + Projects, PR с ревью, protected main; интервью с desk staff, пилот (G3/G4 остаются unverified без людей).

## Идеи на потом (не сделано)
- Подключить реальный почтовый провайдер (Resend + свой домен) и выключить `LOG_SIGNIN_LINKS`.
- Поднять минимум пароля до 15 или оставить студентам только вход по ссылке. Добавить проверку по утёкшим паролям.
- Навигация по таймтейблу стрелками (roving tabindex).
- US-12 (waitlist) и US-13 (напоминания) отложены по плану.
- Админка для заведения новых ассетов (пока только сид).

## Нюансы Render (на что обратить внимание)
- Free Postgres на Render истекает примерно через 30 дней после создания, и на workspace даётся только один free-инстанс. Для долгой жизни нужен платный план или внешний Postgres (Neon) с `DATABASE_SSL=true`.
- Free web service засыпает после ~15 минут без трафика, первый запрос после этого идёт медленно.
- Build: `npm ci --include=dev && npm run build`, потому что при NODE_ENV=production devDeps (vite) иначе не ставятся.
