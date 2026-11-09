# Privacy, test-account boundary and data retention (E-04, E-07)

Owner: Product Owner. Status: **retention period TBD.** Real personal data is still gated, as the plan requires (S2-10, S5-11).

## Test-account boundary
- The pilot runs on synthetic data only:
  - six test assets with fictional inventory numbers;
  - a demo staff account;
  - a demo student account;
  - accounts that testers register themselves.
- Testers are asked, on the sign-in page, not to use their university credentials.
- The team may only run the pilot with real students after the campus asset owner and the IT office give permission (rule R-18). Until then, every Sprint Review states "synthetic data only".
- `npm run demo:reset -- --yes` (or `make demo-reset`) deletes every account and booking and re-creates the demo data. Run it before each Review and after the pilot.

## What the system stores

| Data | Table | Why | Who can see it | How long it is kept now |
|---|---|---|---|---|
| Email, name, role | `accounts` | Sign-in and showing who borrowed an item | The account owner; desk staff see name and email on bookings | Until demo reset (rule TBD) |
| Password hash (scrypt) | `accounts` | Password sign-in | Nobody (one-way hash) | Same as the account |
| Session token hash | `sessions` | Keeping a user signed in | Nobody (hash) | 7 days, then deleted hourly by housekeeping |
| Sign-in link token hash | `login_links` | Email-link sign-in | Nobody (hash) | 15 minutes valid; deleted one day after expiry |
| Bookings and loan history | `reservations` | Loan flow, overdue list, student history | The student (own records only); desk staff | Kept until demo reset, or for `HISTORY_RETENTION_DAYS` if set |
| Staff reason for an unavailable asset | `assets` | Internal maintenance note | Desk staff only | Until the asset returns to service |
| Request log | server log (Render) | Debugging and test evidence | Team members with Render access | Render log retention (provider default) |

The request log contains no names, emails, tokens, cookies or request bodies. It records only the numeric account id.

## Retention decision record (S5-11)

| Item | Proposal for the IT office | Implemented switch | Decision |
|---|---|---|---|
| Expired sessions | Delete at once | Always on (hourly) | Implemented |
| Used or expired sign-in links | Delete one day after expiry | Always on (hourly) | Implemented |
| Returned and cancelled bookings | Keep for one semester (about 180 days), then delete | `HISTORY_RETENTION_DAYS=180` | **TBD: waiting for IT office** |
| Accounts with no activity | Delete after the pilot | `make demo-reset` | **TBD** |
| Pilot observation sheets (paper or files) | Keep anonymised results only; destroy names after the final report | Manual | **TBD** |

Until a decision is recorded, `HISTORY_RETENTION_DAYS` stays at 0, which means history is kept. Nothing is deleted on a guess. When a value is approved, set it in the Render environment and note the date and approver above.

## Privacy checks in the test suite
- A student sees only their own history; another account gets nothing (`test/staff.test.js`, US-10).
- The staff reason for an unavailable asset is never sent to students (`test/staff.test.js`, US-08).
- The request log contains no email, cookie or query string (`test/ops.test.js`).
- The database stores only hashes of session and sign-in tokens (`test/signin-link.test.js`).
- Housekeeping removes expired data and keeps history unless a period is set (`test/signin-link.test.js`).
