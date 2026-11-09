# Accessibility checklist: WCAG 2.2 AA target (G5, E-09)

This is a target checklist, **not a certification**, as the plan says [8]. "Self-check" means a developer checked it. Each row still needs a manual check by the QA contributor (Scrum Master) at the Sprint Review where the screen is demonstrated.

## Automated run, 9 Nov 2026 (release 0.2.0)

- **Tool:** axe-core 4.10.2, rules tagged `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.
- **Browser:** headless Microsoft Edge driven through the DevTools protocol.
- **Data:** production build with demo data.

| Screen | Width | Violations |
|---|---|---|
| Catalogue | 1280 | 0 |
| Catalogue, empty filter result | 1280 | 0 |
| Asset details and timetable | 1280 | 0 |
| Sign in, email link | 1280 | 0 |
| Sign in, password | 1280 | 0 |
| Registration | 1280 | 0 |
| Loan rules | 1280 | 0 |
| My loans, current | 1280 | 0 |
| My loans, history | 1280 | 0 |
| Desk: pickup queue | 1280 | 0 |
| Desk: on loan | 1280 | 0 |
| Desk: overdue | 1280 | 0 |
| Desk: inventory | 1280 | 0 |
| Desk: pickup queue | 390 | 0, no horizontal scroll |
| Catalogue | 390 | 0, no horizontal scroll |

Automated tools find only part of the problems, so the manual rows below matter more.

## Keyboard route (manual check required each Sprint)

The keyboard tab order on the catalogue was recorded in the same run:

> Skip to main content › astanait.edu.kz › Help › Equipment Loan Service (home) › Sign in › Register › Catalogue › Loan rules › breadcrumbs › category filters (All equipment, Laptops, Projectors) › Full loan rules › item links

On the asset page every focusable element showed a visible focus indicator.

| Task | Keys only? | Self-check | Team check |
|---|---|---|---|
| Filter catalogue, clear filter, open an item | Yes | Pass | |
| Pick a pickup hour and a return hour in the timetable, reserve | Yes (Tab, Enter or Space) | Pass, see the known issue below | |
| Request an email link, confirm sign-in | Yes | Pass | |
| Cancel a booking in My loans (browser confirmation dialog) | Yes | Pass | |
| Staff: hand over, record return, withdraw an item and fill the form | Yes | Pass | |

**Known issue (S6-09):** each free timetable cell is a separate Tab stop. Ten days × eight hours means up to 80 stops. This meets WCAG, but it is slow. Improvement for Part 2: arrow-key navigation inside the grid (roving tabindex).

## Success criteria most relevant to this service

| SC | Name | How the app meets it | Self-check |
|---|---|---|---|
| 1.1.1 | Non-text content | Logo images have alt text; timetable buttons have full labels ("Fri 13 Nov, 09:00 to 10:00, free") | Pass |
| 1.3.1 | Info and relationships | Real `<table>` with `<th scope>`; form labels tied to inputs; on phones table cells keep their labels | Pass |
| 1.3.4 | Orientation | Works in portrait and landscape | Pass |
| 1.4.1 | Use of colour | Timetable: booked cells are disabled and labelled "booked", not only grey; statuses are words | Pass |
| 1.4.3 | Contrast (minimum) | Text colours checked by axe; links `#0a5bab` on white | Pass (axe) |
| 1.4.10 | Reflow | No horizontal scroll at 390 px; the timetable scrolls inside its own box | Pass |
| 1.4.11 | Non-text contrast | Inputs and buttons have 1 px borders with enough contrast; focus outline is blue | Self-check |
| 2.1.1 | Keyboard | All actions reachable by keyboard (see the table above) | Pass |
| 2.4.1 | Bypass blocks | "Skip to main content" link | Pass |
| 2.4.3 | Focus order | Follows the visual order | Pass |
| 2.4.7 | Focus visible | Every interactive element has an outline | Pass |
| 2.4.11 | Focus not obscured (minimum), new in 2.2 | No sticky or fixed elements, so nothing covers the focused element | Pass |
| 2.5.8 | Target size (minimum), new in 2.2 | Timetable cells are 24 × 24 px, which is the minimum | Pass, at the limit |
| 3.2.6 | Consistent help, new in 2.2 | "Help" link in the same place on every page | Pass |
| 3.3.1 | Error identification | Field and rule errors in text; `role="alert"` on error notices | Pass |
| 3.3.3 | Error suggestion | Rule errors say what to change ("Pickup must be between 9:00 and 16:00.") | Pass |
| 3.3.7 | Redundant entry, new in 2.2 | After a booking conflict the item stays selected; nothing has to be typed again | Pass |
| 3.3.8 | Accessible authentication (minimum), new in 2.2 | Email-link sign-in needs no memorised password; password fields allow paste and password managers | Pass |
| 4.1.2 | Name, role, value | Native buttons and inputs; `aria-pressed` on selected timetable cells; `aria-current` on the active tab and page | Pass |
| 4.1.3 | Status messages | Booking, return and link-sent messages are in `aria-live` regions | Pass |

## Screen reader

Not tested yet. Planned for S6 with NVDA on Windows. Record the result here.
