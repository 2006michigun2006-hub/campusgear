# Security review: role matrix, OWASP ASVS 5.0.0 and NIST SP 800-63B-4

The plan (section 5) asks for three things:
- a small role matrix with every protected API action tested;
- a review of the authentication design against NIST SP 800-63B-4 [9];
- the ASVS 5.0.0 checklist for access control and sessions [10].

These are **planned checks, not a completed audit or certification**. Developer self-review: 9 Nov 2026, release 0.2.0.

## 1. Role matrix (anonymous / student / staff)

Every row is covered by an automated test unless marked "manual". 401 means "please sign in"; 403 means "not allowed".

| Action | API | Anonymous | Student | Staff | Test |
|---|---|---|---|---|---|
| Browse catalogue, asset details, availability | `GET /api/assets`, `/api/assets/:id` | allowed | allowed | allowed | `api.test.js` US-01 |
| Register (always creates a student) | `POST /api/auth/register` | allowed | allowed | allowed | `api.test.js` "self-registration never grants staff" |
| Request or use a sign-in link | `POST /api/auth/link`, `/link/verify` | allowed | allowed | allowed | `signin-link.test.js` |
| Reserve | `POST /api/reservations` | 401 | allowed | 403 | `api.test.js` "anonymous users cannot reserve; staff cannot reserve as students" |
| Own bookings and history | `GET /api/reservations/mine`, `/history` | 401 | own only | 403 | `staff.test.js` "role matrix for student endpoints", US-10 |
| Cancel a booking | `POST /api/reservations/:id/cancel` | 401 | own only; another student gets 404 | any confirmed booking | `api.test.js` US-05 |
| Pickup queue, on loan, overdue, inventory | `GET /api/staff/*` | 401 | 403 | allowed | `staff.test.js` role matrix (4 tests) |
| Checkout, return | `POST /api/staff/reservations/:id/checkout`, `/return` | 401 | 403 | allowed | `staff.test.js` US-07 |
| Withdraw or return an asset to service | `POST /api/staff/assets/:id/status` | 401 | 403 | allowed | `staff.test.js` US-08 |

Another student's booking returns 404, not 403, so its existence is not revealed.

Roles live only in the database. No request field can set them, and staff accounts are created only by the operator, through environment variables at start-up.

## 2. ASVS 5.0.0: chapters relevant to the pilot

| Chapter | Check | Status | Where |
|---|---|---|---|
| V8 Authorization | Every protected action is checked on the server, not only hidden in the UI | Done | `requireRole` in `server/auth.js`; ownership checks in `routes/reservations.js` |
| V8 Authorization | Users cannot reach other users' records by changing an id | Done | Cancel and history are filtered by `account_id`; tested |
| V7 Session Management | Session token is random (256 bits), stored server-side as a SHA-256 hash | Done | `createSession` |
| V7 Session Management | Cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/` | Done | `setSessionCookie` |
| V7 Session Management | Sign-out deletes the session on the server | Done | `POST /api/auth/logout`; tested |
| V7 Session Management | A new session is issued at every sign-in; the old one is deleted | Done | `routes/auth.js` |
| V7 Session Management | Absolute lifetime (7 days) | Done | `SESSION_DAYS`; expired sessions rejected (tested) and purged hourly |
| V7 Session Management | Inactivity timeout | **Open** | Not implemented; the 7-day absolute limit only. Decide with IT (rule R-17). |
| V6 Authentication | Password storage with a slow, salted hash | Done | scrypt with a 16-byte salt; `timingSafeEqual` |
| V6 Authentication | Brute-force protection | Partly | 30 attempts per 15 minutes per IP on sign-in, register and link routes. No per-account lockout. |
| V6 Authentication | Same reply for known and unknown accounts | Done for links; **open** for registration | Link request: same text (tested). Registration still says "email already exists". This is common practice, but it reveals accounts. |
| V6 Authentication | Out-of-band link: single use, short life, hashed | Done | `signin-link.test.js` |
| V3 Web Frontend Security | Security headers (CSP, HSTS, `X-Content-Type-Options`, frame protection) | Done | `helmet()` defaults |
| V3 Web Frontend Security | CSRF protection | Done | `SameSite=Lax` plus a JSON-only rule for every state-changing API call (415 otherwise; tested) |
| V2 Validation and Business Logic | Server validates every rule, whatever the browser sends | Done | `shared/rules.js` runs on the server; tested |
| V2 Validation and Business Logic | Business limits under concurrency | Done | Database exclusion constraint; 20-pair test |
| V4 API and Web Service | Request size limit | Done | JSON body limit 20 kB |
| V13 Configuration | No secrets in the repository | Done | Render generates passwords (`generateValue`); `.env` is git-ignored; production refuses to start without `DATABASE_URL` and creates no staff account without `STAFF_PASSWORD` |
| V14 Data Protection | Personal data limited to what is needed | Done | Email, name, role only; see `privacy-and-retention.md` |
| V16 Security Logging and Error Handling | Log without sensitive data | Done | Request log has no email, token, cookie or body (tested) |
| V16 Security Logging and Error Handling | Generic error messages for server faults | Done | 500 returns "Something went wrong on the server."; details only in the server log |
| V16 Security Logging and Error Handling | No credentials in logs | **Open (accepted for synthetic pilot)** | `LOG_SIGNIN_LINKS=true` writes sign-in links to the log because no email provider is set. Set it to `false` and add `RESEND_API_KEY` before real users (decision D-06). |
| V12 Secure Communication | HTTPS only | Done on Render | Render terminates TLS; `Secure` cookie; HSTS header |

## 3. NIST SP 800-63B-4 review of the sign-in design

| Topic | Guidance (short) | CampusGear | Gap and action |
|---|---|---|---|
| Email links | Email is not an approved out-of-band channel for higher assurance; acceptable only for low-risk use | Pilot uses synthetic data and holds no money or grades; risk is low | Before real use, ask IT whether campus SSO is required (decision D-05) |
| Secret length | Out-of-band secrets must be random and hard to guess | 256-bit random token | none |
| Lifetime and reuse | Short validity; single use | 15 minutes; atomic single use; older links invalidated | none |
| Password length | Single-factor passwords: at least 15 characters (8 when part of MFA) | Minimum 8 | **Gap.** Raise to 15 or drop password sign-in for students before a real pilot |
| Breached passwords | Compare new passwords with a list of known-compromised ones | Not done | **Gap.** Add a blocklist check, or rely on email links only |
| Composition rules | Do not force mixed character types; allow paste and all characters | No composition rules; paste allowed | none |
| Rate limiting | Limit failed attempts | 30 per 15 minutes per IP | Consider a per-account limit |
| Storage | Salted, slow hash | scrypt | none |
| Session binding | Session secret in a secure cookie; re-authenticate after a set time | HttpOnly Secure cookie; 7 days | Inactivity timeout open (see V7) |

## Open items before any real-user pilot

1. Turn off `LOG_SIGNIN_LINKS` and configure an email provider.
2. Raise the password minimum to 15 characters, or make email links the only student method; add a breached-password check if passwords stay.
3. Agree session inactivity timeout with IT.
4. Get IT approval for the identity choice (D-05) and for data retention (R-15).
