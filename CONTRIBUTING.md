# Working on CampusGear

Team Barcelona / SE-2420. This is how the team works in the repository (plan, sections 4 and 5).

## Board
GitHub Projects board: **Backlog → Ready → In progress → Review → Done**.

One issue per story (`US-xx`), enabler task (`S3-11 / E-05`) or bug. Each issue holds:
- story ID and acceptance examples;
- estimate (hours) and dependency;
- owner and Sprint.

Use the templates in `.github/ISSUE_TEMPLATE/`. Until the board exists, `docs/backlog.md` is the source of truth.

## Branches and pull requests
- Branch from `main`, named by story or task: `us-04-overlap-guard`, `s3-11-request-log`, `fix-123-timezone-label`.
- Open a PR that links its issue (`Closes #12`). Fill in the PR template.
- **Another team member reviews every PR.** The author resolves each comment or records the decision in the PR.
- `main` is protected: a PR, one approving review and a green CI run are required. `main` is what Render deploys and what the Review demonstrates.

## Definition of Done (plan, section 2)
A story is Done only when all seven hold:
1. Acceptance examples pass.
2. Code and configuration are committed and reviewed by another member.
3. Tests run in CI.
4. Role and security tests run when applicable.
5. Changed UI is keyboard-checked and responsive at phone width.
6. A synthetic-data demonstration works in the pilot environment.
7. The issue records evidence and any remaining limits.

A failed overlap, role or privacy check blocks Done. Quality is never waived to meet a date.

## Local commands
```
make dev          # API + Vite with hot reload, http://localhost:5173
make test         # full test suite against local Postgres
make prod         # production build, http://localhost:3000
make demo-reset   # wipe local accounts and bookings, re-seed demo data
```

## Where things are written down
| What | File | Owner |
|---|---|---|
| Loan rules, answered vs TBD | `docs/rule-log.md` | PO |
| Technical and tool decisions | `docs/decision-log.md` | Developers |
| Privacy and retention | `docs/privacy-and-retention.md` | PO |
| Story status and evidence | `docs/backlog.md`, then GitHub issues | PO |
| Review notes, retros, impediments | `docs/scrum-records.md` | SM |
| Accessibility and security checks | `docs/checklists/` | SM (QA) |
| Pilot protocol and task sheets | `docs/pilot/` | PO and SM |
| Release notes | `docs/release-notes.md` | PO |

Important decisions made in chat or calls are copied into an issue or one of these files the same day.
