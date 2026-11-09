# Loan rule log (E-01)

Owner: Product Owner (Yertugan Toktal). Versioned with the repository; every change is a commit.

Each rule below is **provisional** until a named desk or IT contact confirms it. The plan says: "no assumed approval". The app reads every numeric rule from environment variables (`server/config.js`), so a confirmed change needs no code change. It only needs the env value updated and this log edited.

Status values:
- **Provisional:** assumed by the team, implemented, not confirmed.
- **Confirmed:** answered by a named contact, with a date.
- **TBD:** no rule yet; the app takes no automatic action.

## Version 0.2 (9 Nov 2026)

| ID | Rule | Current value in the app | Env override | Source | Status | Decision owner | Due |
|---|---|---|---|---|---|---|---|
| R-01 | Campus time zone used for display and validation | `Asia/Almaty` | `CAMPUS_TZ` | Team assumption (Astana campus) | Provisional | PO with IT office | S2 Review |
| R-02 | Handoff days | Monday to Friday only | `WEEKDAYS_ONLY` | Plan, section 1 | Provisional | PO with desk staff | S2 Review |
| R-03 | Pickup hours | Pickup starts on the hour, 09:00 to 16:00 | `OPEN_HOUR`, `CLOSE_HOUR` | Plan, section 6 (09:00 to 17:00 desk) | Provisional | PO with desk staff | S2 Review |
| R-04 | Return hours | Return due on the hour, 09:00 to 17:00 | `OPEN_HOUR`, `CLOSE_HOUR` | Plan, section 6 | Provisional | PO with desk staff | S2 Review |
| R-05 | Booking lead time | 1 to 14 calendar days ahead (campus dates) | `MIN_LEAD_DAYS`, `MAX_LEAD_DAYS` | Plan, section 1 | Provisional | PO with desk staff | S3 (S3-06) |
| R-06 | Loan length | 1 to 72 hours, whole hours | `MIN_LOAN_HOURS`, `MAX_LOAN_HOURS` | Plan, section 1 | Provisional | PO with desk staff | S3 (S3-06) |
| R-07 | Active bookings per student | At most one active booking per asset and student; several assets allowed | none (database index) | Plan, section 1 | Provisional | PO | S3 |
| R-08 | Overlap | No two Confirmed or Checked-out bookings of one asset may overlap; touching intervals (10:00 to 12:00 and 12:00 to 14:00) are allowed | none (database constraint) | Plan, section 1 | Confirmed by plan (integrity rule, not a desk policy) | BE | n/a |
| R-09 | Cancellation | Student can cancel own booking until checkout; staff can cancel any confirmed booking; cancelled time reopens at once | none | Plan, US-05 | Provisional | PO | S3 |
| R-10 | Early return | Original planned end is kept on the record; unused time is released for new bookings | none | Plan, US-07 | Provisional | PO with desk staff | S4 |
| R-11 | Late return | Return after planned end is recorded and flagged as late. No fee, no message | none | Plan, US-07, US-09 | Provisional | PO with desk staff | S5 |
| R-12 | Overdue | A loan is overdue when it is Checked out and campus time is past the planned end. Listed oldest first | none | Plan, US-09 | Provisional | PO with desk staff | S5 |
| R-13 | Faulty asset | Unavailable asset: new bookings blocked, existing bookings kept and flagged, checkout blocked; staff decide per booking | none | Plan, US-08 | Provisional | PO with desk staff | S5 |
| R-14 | No-show | What happens if a student does not come to pick up | **TBD.** The queue shows "Pickup time passed"; staff may cancel by hand. Nothing is automatic | none | Plan lists it as open | PO with desk staff | S3 (S3-10) |
| R-15 | Data retention | How long loan history and accounts are kept | **TBD.** History is kept; see `privacy-and-retention.md` | `HISTORY_RETENTION_DAYS` | Plan, E-07 | PO with IT office | S5 (S5-11) |
| R-16 | Sign-in link lifetime | Email link works once and expires after 15 minutes | `SIGNIN_LINK_MINUTES` | Team, based on NIST SP 800-63B-4 guidance for out-of-band codes | Provisional | BE with IT office | S2 (S2-08) |
| R-17 | Session lifetime | 7 days, then sign in again | `SESSION_DAYS` | Team assumption | Provisional | BE with IT office | S2 (S2-08) |
| R-18 | Pilot permission | Real students, real inventory | **TBD.** Synthetic inventory and test accounts only | none | Plan, section 1 | PO with campus asset owner | Before S6 |

## Open questions for desk staff

These questions go into the desk interview (`pilot/desk-interview.md`). Record each answer here with the contact's role and the date, then update the Status column.

1. Are handoff hours really 09:00 to 17:00? Is there a lunch break when the desk is closed?
2. Should pickups and returns be on the hour, or every 30 minutes?
3. Is 72 hours too long for projectors? Should the limit differ by asset type?
4. How long do you wait for a no-show before you release the item?
5. Do you need anything printed or signed at checkout?
6. Who owns the inventory list, and who can mark an item faulty?

## Change history

| Version | Date | Change | By |
|---|---|---|---|
| 0.1 | 8 Nov 2026 | Rules taken from the Part 1 plan | PO |
| 0.2 | 9 Nov 2026 | Implemented values and env overrides recorded; R-14 to R-18 added as TBD | Developers |
