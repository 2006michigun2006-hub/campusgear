# Release notes

Every release uses synthetic data only. Use it for the pilot and Reviews, not for real loans.

## 0.2.0 (9 Nov 2026)

**New**
- **US-03: single-use email sign-in links.**
  - Choose Sign in → Email link, enter your email and open the link.
  - The link works once and expires after 15 minutes. Requesting a new link cancels the old one.
  - The Password tab still works.
  - Without an email provider (`RESEND_API_KEY`), links are written to the server log. On Render: campusgear → Logs.
- **Named bookings in the timetable.** Consecutive booked hours show as one cell. The borrower sees their own name, staff see the borrower's name, everyone else sees "Booked".
- **Staff can cancel no-shows.** In the pickup queue, **Cancel booking** now also appears once the pickup time has passed.
- **Request log (S3-11).** One JSON line per API request, with no personal data. Every response carries an `X-Request-Id` header.
- **Demo reset (E-05, E-09).** `make demo-reset` or `npm run demo:reset -- --yes` wipes accounts and bookings and re-creates the demo data.
- **Housekeeping (E-07).** Expired sessions and old sign-in links are deleted every hour. Loan history is kept unless `HISTORY_RETENTION_DAYS` is set.

**Changed**
- Signing in with a password, or registering, now replaces any earlier session in the same browser.

**Docs**
- Added: rule log, decision log, privacy and retention record, staff guide, backlog with acceptance evidence.
- Added: WCAG 2.2 and ASVS/NIST checklists, pilot protocol and task sheets, desk interview prompts, Scrum records.
- Added: contribution guide and GitHub issue and PR templates.

**Tests:** 34 automated tests, all passing (`docs/evidence/test-log.txt`). Includes G2: 20 concurrent request pairs, zero double confirmations.

**Known limits**
- Sign-in links are logged instead of emailed until a provider is configured. This is acceptable for synthetic accounts only.
- The password minimum is 8 characters, below NIST guidance for single-factor passwords (see `checklists/security-asvs-nist.md`).
- The timetable has one Tab stop per hour cell (slow by keyboard, but usable).
- No-show, retention and pilot permission rules are TBD (`rule-log.md`).

## 0.1.0 (9 Nov 2026)

First pilot build: US-01, US-02 and US-04 to US-11, sign-in with email and password, Render Blueprint, CI.

**Known limits**
- US-03 used passwords instead of email links (fixed in 0.2.0).
- G3 and G4 unverified: no pilot yet.
