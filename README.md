# CampusGear

A campus equipment-loan booking portal. Students browse laptops and projectors, check availability and reserve a pickup slot. Desk staff handle pickup, return, faulty equipment and overdue loans.

Team Barcelona / SE-2420 · Project Management end-term project. The plan this implements is in [`docs/`](docs/).

**Stack:** Node.js + Express 5 API · PostgreSQL · React 18 (Vite) · deployed on Render as one web service plus a managed database.

## What is implemented

| Story | Feature | Where it is enforced |
|---|---|---|
| US-01 | Browse and filter assets; empty state; phone layout; keyboard access | `GET /api/assets`, `Catalogue.jsx` |
| US-02 | Asset details and occupied periods in one campus time zone | `GET /api/assets/:id`, `AssetPage.jsx` |
| US-03 | Student accounts and sessions; student access cannot become staff access | `routes/auth.js`, `requireRole` |
| US-04 | Reservations under the loan rules; no double booking | `shared/rules.js` + Postgres `EXCLUDE` constraint |
| US-05 | Owner cancels before checkout; repeating it is harmless; the time reopens | `POST /api/reservations/:id/cancel` |
| US-06 | Staff pickup queue ordered by pickup time | `GET /api/staff/queue` |
| US-07 | Checkout and return; original end preserved; early time released; late return flagged | `routes/staff.js` |
| US-08 | Mark an asset unavailable: blocks new bookings, flags existing ones, keeps the staff reason private | `POST /api/staff/assets/:id/status` |
| US-09 | Overdue list, oldest first, with no automatic fees or messages | `GET /api/staff/overdue` |
| US-10 | A student's own Returned/Cancelled history | `GET /api/reservations/history` |
| US-11 | After a conflict, availability refreshes and the asset stays selected; a retry never duplicates (idempotency key) | `AssetPage.jsx`, `reservations_idempotency` |

US-12 and US-13 (waitlist, reminders) are deferred, as the plan says.

**Pilot loan rules (provisional, configurable via env):**
- Weekdays only.
- Pickup between 09:00 and 16:00; return by 09:00–17:00.
- Pickup 1–14 days ahead.
- Loans last 1–72 hours.
- At most one active booking per asset and student.

**Deviation from the plan:** sign-in uses email + password instead of single-use email links, because the pilot has no email provider yet. Passwords are hashed with scrypt; sessions are server-side and the cookie is httpOnly, Secure and SameSite=Lax.

## Run locally

Requirements: Node 20+ and Docker (for PostgreSQL).

```bash
docker run -d --name campusgear-pg -e POSTGRES_USER=campusgear -e POSTGRES_PASSWORD=campusgear \
  -e POSTGRES_DB=campusgear -p 55432:5432 postgres:16-alpine
docker exec campusgear-pg psql -U campusgear -c "CREATE DATABASE campusgear_test;"

npm install
npm run build && npm start          # http://localhost:3000
# or, with hot reload: npm run dev:server  and  npm run dev:client  (http://localhost:5173)
```

On startup the server applies SQL migrations and seeds six synthetic assets. In development the demo accounts are:
- **Staff:** `staff@campusgear.test` / `staff-demo-pass`
- **Student:** `student@campusgear.test` / `student-demo-pass`. This account already has a returned loan, a cancelled booking, an overdue loan and an upcoming booking.

## Tests

```bash
npm test
```

The tests run against a real PostgreSQL database (`campusgear_test`). They cover:
- the loan rules;
- sign-in and sessions;
- the role matrix (anonymous / student / staff);
- overlap and adjacent-slot cases;
- cancellation idempotency;
- state transitions;
- maintenance flags;
- overdue boundaries;
- history privacy;
- the **G2 check: 20 concurrent request pairs → zero double confirmations**.

GitHub Actions runs the same suite and the client build on every push and PR (`.github/workflows/ci.yml`).

## Deploy to Render

1. Push this repository to GitHub.
2. Render Dashboard → **New → Blueprint** → select the repository. `render.yaml` creates:
   - `campusgear`, a Node web service (free plan, Frankfurt);
   - `campusgear-db`, PostgreSQL 16 (free plan).
3. Wait for the first deploy. The app migrates and seeds itself on start; the health check is `/api/health`.
4. The generated staff and demo-student passwords are under **campusgear → Environment** (`STAFF_PASSWORD`, `DEMO_STUDENT_PASSWORD`).

Free-plan limits to keep in mind:
- The web service sleeps after about 15 minutes idle, so the first request after that is slow.
- The free PostgreSQL instance expires 30 days after creation. For longer use, upgrade the database plan, or point `DATABASE_URL` at another Postgres provider and set `DATABASE_SSL=true`.

## Project layout

```
server/            Express API (app.js, routes/, migrations/, seed.js)
shared/            time-zone helpers and loan rules used by both server and browser
client/            React front end (Vite root)
test/              node:test + supertest suites
docs/              Part 1 plan and working notes
render.yaml        Render Blueprint
```
