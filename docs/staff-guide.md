# CampusGear desk guide (one page)

For desk staff at the Library desk and the IT help desk. Pilot version 0.2, synthetic data only.

## Sign in
1. Open the service address you were given. Choose **Sign in**.
2. Use **Email link**: type your staff email, press **Send sign-in link**, open the email and press **Continue**. The link works once and for 15 minutes.
   - You can also use the **Password** tab.
3. You land on the **Loan desk**. The four tabs are Pickup queue, On loan, Overdue and Inventory.

All times are campus time (Asia/Almaty).

## Hand over an item (pickup)
1. Open **Pickup queue**. Bookings are listed by pickup time, earliest first.
2. Ask the student for their name and check it against the **Borrower** column.
3. Take the item with the inventory number shown under the item name (for example `LAP-002`).
4. Press **Hand over**. The booking moves to **On loan**, and the student sees "On loan" in their account.

If the row says **Pickup time passed**, the student is late. There is no automatic no-show rule yet. Use your judgement; if the student is not coming, press **Cancel booking** on that row. The time becomes free for others.

## Take an item back (return)
1. Open **On loan** (or **Overdue** if it is late). Find the booking number or the student.
2. Check the item and its accessories (charger, cables, remote).
3. Press **Record return**. The message tells you whether the return was early, on time or late.
   - **Early:** the rest of the booked time becomes free for other students.
   - **Late:** the return is recorded as late. The service does not charge fees or send messages.

## Overdue loans
**Overdue** lists items that are on loan and past their return time, oldest first. Follow up with the student in person or by email; the service does not contact them.

## An item is faulty
1. Open **Inventory** and press **Withdraw** next to the item.
2. Write the **Reason**. Only staff see it (for example "Fan noise, sent to IT").
3. Optionally change the **Notice for students** (default: "Temporarily unavailable for maintenance.").
4. Press **Withdraw item**. New bookings stop at once.
5. Existing bookings are **not** cancelled. The list of affected bookings appears; they are also marked **Item withdrawn** in the Pickup queue, and **Hand over** is not offered for them. For each one, contact the student and either:
   - press **Cancel booking**, or
   - keep it if the item will be repaired in time.
6. When the item is fixed, press **Return to service**.

## Something went wrong
- An error message on screen tells you what to do. If it does not, note the time, the booking number and what you pressed, and tell the team. They can find the request in the server log by its time.
- Nothing you do can create a double booking: the database refuses it.
- If you pressed the wrong button, tell the team. Checkout and return cannot be undone from the screen.

## What the service does not do (pilot)
- No fees, penalties or damage claims.
- No barcode scanning.
- No reminders to students.
- No waitlist.
