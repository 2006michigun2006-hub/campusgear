# Decision log

The plan (section 5) asks the team to record hosting, sign-in and tool choices here. Each entry gives the options considered, the choice, the reason and what would make the team revisit it. Later decisions are added at the bottom; old ones are never edited. A decision that is replaced gets a new entry that says so.

| ID | Date | Decision | Status |
|---|---|---|---|
| D-01 | 8 Nov 2026 | Scrum, six two-week Sprints | Accepted (plan) |
| D-02 | 9 Nov 2026 | Node.js + Express API, React front end, one web service | Accepted |
| D-03 | 9 Nov 2026 | PostgreSQL with a range exclusion constraint for non-overlap | Accepted |
| D-04 | 9 Nov 2026 | Render for pilot hosting | Accepted |
| D-05 | 9 Nov 2026 | Own email-link sign-in instead of a hosted identity provider; password kept as fallback | Accepted, review at S2 |
| D-06 | 9 Nov 2026 | Resend as the optional email provider; log transport for the demo | Accepted, review at S2 |
| D-07 | 9 Nov 2026 | Campus time zone stored as configuration, all times in UTC in the database | Accepted |
| D-08 | 9 Nov 2026 | Idempotency key on reservation requests | Accepted |
| D-09 | 9 Nov 2026 | Unavailable assets flag bookings, never cancel them automatically | Accepted |
| D-10 | 9 Nov 2026 | Test inventory uses common commercial model names with fictional inventory numbers | Accepted, review at S5 |
| D-11 | 9 Nov 2026 | Structured request log without personal data | Accepted |
| D-12 | 9 Nov 2026 | Front end styled as a university service page, with a "not an official AITU service" notice | Accepted |

---

### D-01 Scrum with six two-week Sprints
See plan, section 2. Revisit if the team cannot hold regular Reviews or the work becomes mostly unplanned support; then switch to Kanban with explicit WIP limits.

### D-02 Stack: Node.js 22, Express 5, React 18 with Vite
- **Options:**
  - Node/Express + React;
  - Python/Django with server-rendered pages;
  - Java/Spring.
- **Choice:** Node/Express + React.
  - One language on both sides.
  - The loan rules live in `shared/rules.js` and run in the browser (instant feedback) and on the server (the authority) without being written twice.
  - Express serves the built client, so the pilot is one web service.
- **Revisit if:** a team member who must maintain it cannot work in JavaScript.

### D-03 PostgreSQL and an exclusion constraint
- **Options:**
  - MongoDB with application-level locking;
  - PostgreSQL with `SELECT … FOR UPDATE`;
  - PostgreSQL with an `EXCLUDE USING gist` constraint on `tstzrange`.
- **Choice:** the exclusion constraint (`reservations_no_overlap`). Only Confirmed and Checked-out rows take part, so cancelled and returned time reopens automatically.
  - G2 (zero double confirmations) is then guaranteed by the database, whatever the application code does.
  - The plan names this option [11].
- **Evidence:** `test/api.test.js`, "20 concurrent request pairs yield zero double confirmations".
- **Side effect:** under concurrent inserts Postgres can report a deadlock (40P01) inside the constraint check. `server/db.js` retries the transaction, and the retry ends in a clean 409 conflict.

### D-04 Render for hosting
- **Options:** Render, Railway, Fly.io, a university VM.
- **Choice:** Render Blueprint (`render.yaml`). It creates the web service and the managed Postgres together and wires `DATABASE_URL` without manual steps. It has a free plan.
- **Limits accepted for the pilot:**
  - the free web service sleeps after about 15 minutes idle;
  - the free database expires after 30 days.
- **Revisit:** before any pilot that runs longer than 30 days.

### D-05 Sign-in: own single-use email links, password as fallback
- **Plan wording:** "hosted sign-in" with "email-link callback" (S2-05), compared in S2-08.
- **Options:**
  - hosted identity provider (Auth0, Clerk, Supabase Auth);
  - campus single sign-on (out of scope in the plan);
  - own email links;
  - passwords only.
- **Choice:** own email links (US-03 acceptance: valid single-use link works, expired or reused links fail, student cannot become staff), plus passwords as a fallback.
  - A hosted provider adds a third-party processor of student emails. That needs the consent and data-processing review the plan says is still open (S2-08, S2-10).
  - The link design is small and fully testable in CI.
  - Passwords stay as a fallback: the free demo cannot send real email to `.test` addresses, and desk staff must not be locked out if the email provider fails.
- **Design:**
  - 256-bit random token; only its SHA-256 hash is stored.
  - 15-minute lifetime; used at most once (atomic update).
  - A new link replaces older unused ones.
  - The same reply whether or not the address is registered.
  - The token sits in the URL fragment, so it never appears in server logs.
  - Signing in needs a button press, so mail scanners that open links do not use them up.
  - Accounts keep the role stored in the database, so a link cannot raise privileges.
- **Evidence:** `test/signin-link.test.js`.
- **Revisit:** at S2 Review, with the IT office. If they require campus SSO or a hosted provider, this entry is replaced.

### D-06 Email delivery
- **Choice:** Resend over HTTPS when `RESEND_API_KEY` is set. Otherwise, with `LOG_SIGNIN_LINKS=true`, the link is written to the server log so the team can demonstrate the flow.
- **Accepted risk:** the log transport writes a credential to the log. It is only acceptable while all accounts are synthetic. It must be switched off (`LOG_SIGNIN_LINKS=false`) before any real student uses the pilot. This is listed in the ASVS checklist as an open item.

### D-07 Time zone
All timestamps are stored as `timestamptz` (UTC). The campus zone (`CAMPUS_TZ`, default `Asia/Almaty`) is used to check weekdays, opening hours and lead days, and to label every time in the interface. Rule R-01 is still provisional.

### D-08 Idempotent reservation requests
- **US-11:** "retry makes no duplicate booking".
- The browser sends a random `idempotencyKey` with each reservation attempt. A unique index on (account, key) makes a repeated request return the original booking instead of creating a second one.

### D-09 Faulty assets flag, never delete
- **US-08:** "existing bookings flagged, never silently deleted".
- Marking an asset unavailable blocks new bookings and checkout. Existing bookings stay and are shown to staff with a warning; staff cancel them one by one if needed.
- The staff reason is stored separately from the public notice and is never sent to students.

### D-10 Test inventory names
- **Plan wording:** S1-05 asks for "clearly synthetic records"; S5-12 asks to remove real-looking test identifiers.
- **Choice:** the six items use common commercial model names (for example "Lenovo ThinkPad E14 Gen 5"), because testers found invented names confusing and unrealistic. They are not taken from the AITU asset register.
  - Inventory numbers (`LAP-001`, `PRJ-001`) are fictional.
  - Accounts use the reserved `.test` domain.
  - Every page footer says "Test data only".
- **Revisit at S5 (S5-12):** if the asset owner objects, rename the items in `server/seed.js`. The seed updates them on the next start.

### D-11 Request log
- **S3-11:** "request logging in demo".
- One JSON line per API request: time, request id, method, path without query string, status, duration, error code, numeric account id and role.
- No emails, names, cookies, tokens or request bodies.
- Health checks are not logged.
- The `X-Request-Id` response header lets a tester quote a request in a bug report.

### D-12 Front-end style
- The service imitates the layout of the AITU website (logo, navy header, breadcrumbs, plain tables, Arial).
- It always shows "Student pilot project · not an official AITU service", because it runs on a public URL.
- The logo is used only for this course project; the team must ask the university before any wider use.
