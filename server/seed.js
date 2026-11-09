// Synthetic pilot data only (Part 1: "the team will use synthetic inventory and test accounts").
import { addDaysToKey, campusDateKey, parseKey, weekdayOfKey, zonedToUtc } from '../shared/time.js';
import { hashPassword } from './auth.js';
import { config } from './config.js';
import { pool } from './db.js';

// Test inventory for the pilot (not the real campus asset register).
export const DEMO_ASSETS = [
  { id: 'LAP-001', name: 'Lenovo ThinkPad E14 Gen 5', type: 'laptop', condition: 'Good', pickup: 'Library desk, ground floor', description: 'Intel Core i5, 16 GB RAM, 512 GB SSD. Charger included.' },
  { id: 'LAP-002', name: 'HP ProBook 450 G10', type: 'laptop', condition: 'Very good', pickup: 'Library desk, ground floor', description: '15.6-inch screen, Intel Core i7, 16 GB RAM. Charger included.' },
  { id: 'LAP-003', name: 'Apple MacBook Air 13 (M2)', type: 'laptop', condition: 'Fair, scratched lid', pickup: 'IT help desk, block C', description: '8 GB RAM, 256 GB SSD. USB-C charger and HDMI adapter included.' },
  { id: 'PRJ-001', name: 'Epson EB-E01', type: 'projector', condition: 'Good', pickup: 'Library desk, ground floor', description: '3300 lm, XGA. HDMI cable and remote in the bag.' },
  { id: 'PRJ-002', name: 'BenQ MW560', type: 'projector', condition: 'Very good', pickup: 'IT help desk, block C', description: '4000 lm, WXGA. HDMI and VGA cables, remote.' },
  { id: 'PRJ-003', name: 'XGIMI MoGo 2', type: 'projector', condition: 'Good', pickup: 'IT help desk, block C', description: 'Portable, battery lasts about 2 hours. USB-C charger.' },
];

async function upsertAccount(client, email, name, password, role) {
  const hash = await hashPassword(password);
  const { rows } = await client.query(
    `INSERT INTO accounts(email, name, password_hash, role) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
     RETURNING id`,
    [email, name, hash, role],
  );
  return rows[0].id;
}

function nextWeekdayAt(hour, afterDays = 1) {
  const tz = config.rules.timeZone;
  let key = addDaysToKey(campusDateKey(new Date(), tz), afterDays);
  while (weekdayOfKey(key) > 5) key = addDaysToKey(key, 1);
  return zonedToUtc({ ...parseKey(key), hour }, tz);
}

export async function seed(db = pool) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const a of DEMO_ASSETS) {
      await client.query(
        `INSERT INTO assets(id, name, type, condition, pickup_location, description)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, condition = EXCLUDED.condition,
           pickup_location = EXCLUDED.pickup_location, description = EXCLUDED.description`,
        [a.id, a.name, a.type, a.condition, a.pickup, a.description],
      );
    }

    let staffId = null;
    if (config.staffPassword) {
      staffId = await upsertAccount(client, config.staffEmail, 'Desk Staff (demo)', config.staffPassword, 'staff');
    } else {
      console.warn('STAFF_PASSWORD is not set: no staff account was created.');
    }

    if (config.demoStudentPassword) {
      const studentId = await upsertAccount(client, config.demoStudentEmail, 'Demo Student', config.demoStudentPassword, 'student');
      const { rows } = await client.query('SELECT count(*)::int AS n FROM reservations WHERE account_id = $1', [studentId]);
      if (rows[0].n === 0) {
        const day = 86400000;
        const now = Date.now();
        const hourAgo = (h) => new Date(Math.floor(now / 3600000) * 3600000 - h * 3600000);
        // Past returned loan, a cancelled booking, an overdue loan and an upcoming booking.
        await client.query(
          `INSERT INTO reservations(asset_id, account_id, start_at, planned_end_at, status, checked_out_at, checked_out_by, returned_at, returned_by)
           VALUES ('PRJ-001', $1, $2, $3, 'returned', $2, $4, $3, $4)`,
          [studentId, hourAgo(24 * 10), hourAgo(24 * 10 - 4), staffId],
        );
        await client.query(
          `INSERT INTO reservations(asset_id, account_id, start_at, planned_end_at, status, cancelled_at, cancelled_by)
           VALUES ('LAP-002', $1, $2, $3, 'cancelled', $4, $1)`,
          [studentId, hourAgo(24 * 6), hourAgo(24 * 6 - 3), new Date(now - 8 * day)],
        );
        await client.query(
          `INSERT INTO reservations(asset_id, account_id, start_at, planned_end_at, status, checked_out_at, checked_out_by)
           VALUES ('LAP-003', $1, $2, $3, 'checked_out', $2, $4)`,
          [studentId, hourAgo(24 * 3), hourAgo(24), staffId],
        );
        const start = nextWeekdayAt(10);
        await client.query(
          `INSERT INTO reservations(asset_id, account_id, start_at, planned_end_at, status)
           VALUES ('LAP-001', $1, $2, $3, 'confirmed')`,
          [studentId, start, new Date(start.getTime() + 2 * 3600000)],
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
