import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { book, config, makeAccount, pool, setup, slot, teardown } from './helpers.js';
import { resetDemo } from '../server/reset-demo.js';

let server;
let api;
before(async () => ({ server, api } = await setup()));
after(() => teardown(server));

describe('S3-11 request log', () => {
  test('logs one JSON line per API call without emails, tokens or query strings', async () => {
    const student = await makeAccount('student');
    const lines = [];
    const original = console.log;
    config.logRequests = true;
    console.log = (line) => lines.push(String(line));
    try {
      const res = await api().get('/api/reservations/mine?secret=x').set('Cookie', student.cookie).expect(200);
      await api().post('/api/auth/link').send({ email: student.email }).expect(200);
      await api().get('/api/staff/queue').set('Cookie', student.cookie).expect(403);
      await new Promise((r) => setImmediate(r));
      assert.ok(res.headers['x-request-id']);
    } finally {
      console.log = original;
      config.logRequests = false;
    }
    const entries = lines.map((l) => JSON.parse(l));
    assert.equal(entries.length, 3);
    assert.deepEqual(entries[0], { ...entries[0], method: 'GET', path: '/api/reservations/mine', status: 200, account: student.id, role: 'student' });
    assert.equal(entries[2].error, 'FORBIDDEN');
    const raw = lines.join('\n');
    assert.ok(!raw.includes(student.email), 'email must not be logged');
    assert.ok(!raw.includes('secret'), 'query strings must not be logged');
    assert.ok(!raw.includes('cg_session'), 'cookies must not be logged');
  });
});

describe('E-09 demo reset', () => {
  test('removes all bookings and accounts, returns assets to service and re-seeds', async () => {
    const student = await makeAccount('student');
    await book(api, student.cookie, 'PRJ-003', slot(2, 9, 2)).expect(201);
    await pool.query(`UPDATE assets SET status = 'unavailable', unavailable_reason = 'test' WHERE id = 'LAP-002'`);

    await resetDemo(pool);

    assert.equal((await pool.query('SELECT 1 FROM accounts WHERE email = $1', [student.email])).rowCount, 0);
    const { rows: accounts } = await pool.query('SELECT email, role FROM accounts ORDER BY role');
    assert.deepEqual(accounts.map((a) => a.role), ['staff', 'student']);
    const { rows: [asset] } = await pool.query(`SELECT status, unavailable_reason FROM assets WHERE id = 'LAP-002'`);
    assert.deepEqual(asset, { status: 'available', unavailable_reason: null });
    const { rows: [{ n }] } = await pool.query('SELECT count(*)::int AS n FROM reservations');
    assert.equal(n, 4); // the demo student's seeded history
  });
});
