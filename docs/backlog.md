# Product Backlog status and acceptance evidence

Owner: Product Owner. Updated 9 Nov 2026 (release 0.2.0).

This file stands in for the issue board until the GitHub repository and Project board exist (S1-03). After that, each row becomes an issue (use `.github/ISSUE_TEMPLATE/story.md`). The evidence column is copied into the issue, as the Definition of Done asks ("the issue records evidence and any remaining limits").

## How to read the status

| Status | Meaning |
|---|---|
| Built | Code and automated tests exist and pass in CI. Not yet Done. |
| Done | All seven Definition of Done items hold, including another member's review and a Sprint Review demonstration. |
| Deferred | Outside the six-Sprint forecast. |

No story is **Done** yet. The code was built ahead of the Sprint calendar (Sprint 1 starts 16 Nov 2026). DoD item 2 (review by another member) and item 7 (evidence in the issue) need the GitHub workflow. Item 6 (demonstration in the pilot environment) happens at each Sprint Review. The team should move stories to Done Sprint by Sprint, as the plan orders them.

## User stories

| Story | Sprint | Acceptance criteria (plan) | Status | Automated evidence | Manual evidence still needed |
|---|---|---|---|---|---|
| US-01 Filter assets by type | S1 | matching / cleared / empty filters; phone layout; keyboard order; six synthetic assets | Built | `api.test.js` "lists six synthetic assets anonymously and filters by type"; axe and keyboard run in `checklists/accessibility-wcag22.md` | Team keyboard check at S1 Review |
| US-02 Details and available periods | S2 | ID, condition, pickup data; confirmed time blocked; cancelled time reopened; one campus time zone | Built | `api.test.js` "valid booking blocks time; adjacent slot stays valid; cancel reopens"; `rules.test.js` "zone round-trip keeps wall-clock time" | Desk staff confirm fields and hours (S2-04) |
| US-03 Sign in | S2 | valid single-use link works; expired / reused links fail; student cannot become staff | Built | `signin-link.test.js` (all six tests); `api.test.js` "US-03 accounts and sessions" | Provider and consent review with IT (S2-08) |
| US-04 Valid reservation | S3 | time rules; one active booking per asset / student; zero double confirmations in 20 concurrent pairs; adjacent slots valid | Built | `rules.test.js` (4 tests); `api.test.js` "server enforces loan rules", "valid booking blocks time…", "20 concurrent request pairs yield zero double confirmations" | Rule sign-off (S3-06, S3-10) |
| US-05 Cancel | S3 | owner only, before checkout; time reopens; repeated cancellation harmless | Built | `api.test.js` "valid booking blocks time; adjacent slot stays valid; cancel reopens" (non-owner 404, repeat 200); `staff.test.js` "valid transitions only…" (no cancel after checkout) | none |
| US-06 Pickup queue | S4 | confirmed bookings sorted by pickup; cancelled excluded; student / anonymous denied | Built | `staff.test.js` "queue is ordered by pickup and excludes cancelled"; role matrix (4 tests) | Staff confirm queue fields (S4-03) |
| US-07 Checkout and return | S4 | staff-only valid transitions; original end preserved; early time released; late return flagged | Built | `staff.test.js` "valid transitions only; original end preserved; early return releases time"; "only checked-out loans past planned end, oldest first" (late flag) | Staff walkthrough with guide (G4) |
| US-08 Mark asset unavailable | S5 | new bookings blocked; existing flagged, never silently deleted; staff reason private | Built | `staff.test.js` "blocks new bookings, flags existing ones and keeps the reason private" | Policy review (S5-04) |
| US-09 Overdue list | S5 | only checked-out past planned end; oldest first; no automatic fee or message | Built | `staff.test.js` "only checked-out loans past planned end, oldest first" | none |
| US-10 Own history | S5 | own Returned / Cancelled only; other account denied; clear empty state | Built | `staff.test.js` "a student only sees their own Returned/Cancelled records" | Retention decision (S5-11) |
| US-11 Refresh after conflict | S6 | newly occupied time disappears; asset choice persists; retry makes no duplicate | Built | `api.test.js` "US-11: retry with the same idempotency key does not create a duplicate"; front end: `AssetPage.jsx` reloads availability on `SLOT_TAKEN` and keeps the item | Concurrent walkthrough (S6-03) |
| US-12 Waitlist | later | | Deferred | | |
| US-13 Pickup reminder | later | | Deferred | | |

## Enablers

| Enabler | What the plan asks | Where it is now |
|---|---|---|
| E-01 Desk rules | Interview prompts; versioned rule log with answered vs TBD | `pilot/desk-interview.md`, `rule-log.md`. Interviews not held yet. |
| E-02 Repository and CI | Repository, issue board, PR convention, build and test command, CI, demo reset | Git repository; `CONTRIBUTING.md`; `.github/` templates; `.github/workflows/ci.yml`; `make test`; `make demo-reset`. Board needs GitHub. |
| E-03 Asset model and contract | Six synthetic records, documented fields, API fixture | `server/migrations/001_init.sql`, `server/seed.js`, `README.md` API table |
| E-04 Identity, secrets, privacy | Provider comparison, secret handling, retention and test-account boundary | `decision-log.md` D-05 and D-06; `render.yaml` generates secrets; `.env.example`; `privacy-and-retention.md` |
| E-05 Rule sign-off, logging, evidence | Edge-case sign-off, seed reset, request logging, test evidence | `rule-log.md` open questions; `server/requestLog.js`; `make demo-reset`; `evidence/test-log.txt` |
| E-06 Staff guide and demo | One-page guide, observation tasks, end-to-end demo | `staff-guide.md`, `pilot/staff-task-sheet.md` |
| E-07 Retention | Retention decision record; remove real-looking test identifiers | `privacy-and-retention.md`; `server/housekeeping.js`; decision D-10 |
| E-08 Pilot | Volunteer protocol, consent, task sheets, findings | `pilot/test-protocol.md`, `pilot/student-task-sheet.md`, `pilot/staff-task-sheet.md`. Pilot not run. |
| E-09 Release checks | CI regression; keyboard and phone checks; reset; staff guide; release notes | CI; `checklists/`; `release-notes.md` |

## Goals

| Goal | Target | Status on 9 Nov 2026 |
|---|---|---|
| G1 End-to-end loan flow | S4: student books; staff checks out and returns one synthetic asset | Works in a team-run browser test. Needs the S4 Review demo. |
| G2 Allocation integrity | 20 concurrent pairs, zero double confirmations | Passing in CI (`evidence/test-log.txt`) |
| G3 Student usability | 4 of 5 students reserve unaided in 5 minutes or less | **Unverified:** no pilot yet |
| G4 Staff usability | 2 staff complete queue, checkout and return with the guide | **Unverified:** no pilot yet |
| G5 Quality | CI, role and keyboard checks on every increment | CI and role tests automated; WCAG checklist self-assessed, team check pending |
| G6 Exception control | Faulty assets block new bookings without losing existing ones; overdue list correct | Passing in tests; staff Review pending |
