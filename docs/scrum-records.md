# Scrum records

The plan asks for Review notes ("observation, decision, owner and due date"), one Retrospective improvement per Sprint with an owner, and an impediment log kept by the Scrum Master. Fill in the tables as the Sprints happen. Empty rows mean the event has not happened yet. Do not back-fill events that were not held.

Sprint calendar (plan, section 3; subject to the academic calendar):

| Sprint | Dates | Sprint Goal (from the plan) |
|---|---|---|
| S1 | 16–29 Nov 2026 | Browse and filter synthetic assets |
| S2 | 30 Nov–13 Dec 2026 | Availability and test sign-in |
| S3 | 14–27 Dec 2026 | Reserve, prevent overlaps, cancel |
| S4 | 28 Dec 2026–10 Jan 2027 | Staff pickup, checkout and return |
| S5 | 11–24 Jan 2027 | Maintenance, overdue and history |
| S6 | 25 Jan–7 Feb 2027 | Conflict recovery and pilot |

## Sprint Review notes

Demo script for every Review:
1. `make demo-reset`.
2. Run `make test` and show the summary (`docs/evidence/test-log.txt` is the stored copy).
3. Show the stories of the Sprint in the browser, on a laptop and at phone width.

If no student or staff stakeholder attends, write "no external stakeholder" in the attendees column. The Sprint then cannot claim validation (plan, section 2).

| Sprint | Date | Attendees (roles) | Increment shown | Observation | Decision | Owner | Due |
|---|---|---|---|---|---|---|---|
| S1 | | | | | | | |
| S2 | | | | | | | |
| S3 | | | | | | | |
| S4 | | | | | | | |
| S5 | | | | | | | |
| S6 | | | | | | | |

## Retrospectives

| Sprint | What helped | What hurt | One improvement | Owner | Checked next Sprint? |
|---|---|---|---|---|---|
| S1 | | | | | |
| S2 | | | | | |
| S3 | | | | | |
| S4 | | | | | |
| S5 | | | | | |
| S6 | | | | | |

## Impediment log (Scrum Master)

If a member loses 5 or more hours, reduce the Sprint forecast by at least that much and note it here (plan, cross-Sprint gate).

| ID | Raised | Impediment | Effect on forecast (h) | Action | Owner | Closed |
|---|---|---|---|---|---|---|
| I-01 | 9 Nov 2026 | No GitHub repository or board yet; PR review and evidence-in-issue (DoD 2 and 7) are impossible | 0 | Create the repository and Project board in S1-03 | SM | |
| I-02 | 9 Nov 2026 | Desk rules unconfirmed (rule log R-01 to R-18) | 0 | Desk interview in S1-01 and S1-02 | PO | |
| I-03 | 9 Nov 2026 | No email provider; sign-in links go to the server log | 0 | Choose a provider and sender domain with IT (S2-08) | BE | |
