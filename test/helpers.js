import './env.js';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDaysToKey, campusDateKey, parseKey, weekdayOfKey, zonedToUtc } from '../shared/time.js';
import { createApp } from '../server/app.js';
import { SESSION_COOKIE, createSession, hashPassword } from '../server/auth.js';
import { config } from '../server/config.js';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { DEMO_ASSETS } from '../server/seed.js';

export { pool, config };

let passwordHash;

/** Fresh schema + six synthetic assets, and an HTTP server for supertest. */
export async function setup() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(pool);
  for (const a of DEMO_ASSETS) {
    await pool.query(
      `INSERT INTO assets(id, name, type, condition, pickup_location, description) VALUES ($1,$2,$3,$4,$5,$6)`,
      [a.id, a.name, a.type, a.condition, a.pickup, a.description],
    );
  }
  passwordHash ??= await hashPassword('correct-horse');
  const server = createApp().listen(0);
  return { server, api: () => request(server) };
}

export async function teardown(server) {
  await new Promise((r) => server.close(r));
  await pool.end();
}

/** Creates an account directly and returns { id, cookie } for an authenticated session. */
export async function makeAccount(role = 'student', name = role) {
  const email = `${role}-${randomUUID()}@test.local`;
  const { rows } = await pool.query(
    'INSERT INTO accounts(email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [email, name, passwordHash, role],
  );
  const token = await createSession(rows[0].id, pool);
  return { id: rows[0].id, email, cookie: `${SESSION_COOKIE}=${token}` };
}

/** n-th weekday on or after the earliest bookable day, at a campus hour. Returns {start, end} ISO strings. */
export function slot(n, hour, hours = 1) {
  const tz = config.rules.timeZone;
  let key = addDaysToKey(campusDateKey(new Date(), tz), config.rules.minLeadDays);
  let seen = -1;
  for (;;) {
    if (weekdayOfKey(key) <= 5 && ++seen === n) break;
    key = addDaysToKey(key, 1);
  }
  const start = zonedToUtc({ ...parseKey(key), hour }, tz);
  const end = new Date(start.getTime() + hours * 3600000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function book(api, cookie, assetId, interval, extra = {}) {
  return api().post('/api/reservations').set('Cookie', cookie).send({ assetId, ...interval, ...extra });
}
