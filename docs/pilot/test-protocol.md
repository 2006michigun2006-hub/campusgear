# Pilot test protocol (E-08, Sprint 6)

**Goals measured:**
- **G3:** at least 4 of 5 recruited students reserve unaided in 5 minutes or less.
- **G4:** at least 2 staff complete queue, checkout and return using the staff guide.

- **Owner:** Product Owner (recruitment, decisions). **Facilitator:** Scrum Master. **Note-taker:** a Developer.
- **Status:** not run. No volunteers recruited yet. If fewer people take part, report the actual number and mark the goal **unverified**. A team demo is not a user study.

## Before the session
1. Campus permission recorded (rule R-18). Without it, run sessions only with classmates who are told it is a course exercise, and say so in the report.
2. Run `make demo-reset` (or `npm run demo:reset -- --yes` against the pilot database). This gives clean synthetic data, the demo staff account and fresh test accounts.
3. Prepare one test account per participant (`p1@campusgear.test` … `p5@campusgear.test`), registered by the facilitator. Participants never use their own university account or email.
4. Check that the pilot URL loads and `/api/health` answers.
5. Print the task sheet and a consent note.

## Selection
- **Students:** any enrolled student who has not seen CampusGear before. Team members and people who watched a demo are excluded.
- **Staff:** people who hand out equipment at the Library or IT desk.
- Aim for five students and two staff, as the plan says.

## Consent (read aloud, then ask "Is that OK?")
> We are testing a student project, not you. The site uses made-up equipment and accounts. We will time the tasks and note where the site was confusing. We will not record your name, face or voice. You can stop at any time without giving a reason. The results go into an anonymous course report.

Record "consent given: yes/no" on the sheet. No signature, no name.

## During each session
- One participant at a time, on a laptop or their own phone (note which).
- Give the task card. Say: "Please think aloud. I cannot help with the site, but I can repeat the task."
- Start the timer when they first touch the device. Stop it when the task's success condition appears on screen.
- **Do not help.** If the participant is stuck for 2 minutes or asks to stop, record "assisted" or "gave up" and move on.
- Note every error message they see and every wrong turn. Write what they said, not your interpretation.

## Success rules
- **Student task (G3):** success = a confirmed reservation visible in My loans, made **without help**, within **5:00**.
- **Staff tasks (G4):** success = all three tasks (find in queue, hand over, record return) done with only the staff guide.

## After the session
- Ask the two closing questions on the sheet.
- Enter the results in the results table. Open one GitHub issue per new defect, with the sheet number as evidence (S6-07).
- After the last session, run `make demo-reset` again (S6-10, data cleanup) and destroy paper notes that contain anything identifying.

## Results (fill in after the pilot)

| Sheet | Role | Device | Time | Success (unaided) | Errors seen | Notes |
|---|---|---|---|---|---|---|
| S1 | student | | | | | |
| S2 | student | | | | | |
| S3 | student | | | | | |
| S4 | student | | | | | |
| S5 | student | | | | | |
| T1 | staff | | | | | |
| T2 | staff | | | | | |

**G3 result:** __ of __ students succeeded (target 4 of 5). **G4 result:** __ of __ staff succeeded (target 2).
