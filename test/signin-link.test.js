import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { makeAccount, pool, setup, teardown } from './helpers.js';
import { purgeExpired } from '../server/housekeeping.js';

let server;
let api;
before(async () => ({ server, api } = await setup()));
after(() => teardown(server));

const tokenOf = (devLink) => devLink.split('#/signin/')[1];

async function requestLink(email) {
  const res = await api().post('/api/auth/link').send({ email }).expect(200);
  return res.body;
}

describe('US-03 single-use sign-in links', () => {
  test('a valid link signs the matching account in exactly once', async () => {
    const student = await makeAccount('student', 'Link Student');
    const reply = await requestLink(student.email.toUpperCase());
    assert.match(reply.devLink, /\/#\/signin\/[A-Za-z0-9_-]{43}$/);

    const agent = request.agent(server);
    const ok = await agent.post('/api/auth/link/verify').send({ token: tokenOf(reply.devLink) }).expect(200);
    assert.equal(ok.body.account.id, student.id);
    assert.equal((await agent.get('/api/auth/me')).body.account.email, student.email);

    const again = await api().post('/api/auth/link/verify').send({ token: tokenOf(reply.devLink) }).expect(410);
    assert.equal(again.body.error.code, 'LINK_USED');
  });

  test('expired, unknown and replaced links fail', async () => {
    const student = await makeAccount('student');
    const first = tokenOf((await requestLink(student.email)).devLink);
    const second = tokenOf((await requestLink(student.email)).devLink);
    // Requesting a new link invalidates the older unused one.
    assert.equal((await api().post('/api/auth/link/verify').send({ token: first }).expect(400)).body.error.code, 'LINK_INVALID');

    await pool.query(`UPDATE login_links SET expires_at = now() - interval '1 second' WHERE account_id = $1`, [student.id]);
    assert.equal((await api().post('/api/auth/link/verify').send({ token: second }).expect(410)).body.error.code, 'LINK_EXPIRED');

    await api().post('/api/auth/link/verify').send({ token: 'not-a-real-token' }).expect(400);
    await api().post('/api/auth/link/verify').send({}).expect(400);
  });

  test('two simultaneous clicks on one link create one session', async () => {
    const student = await makeAccount('student');
    const token = tokenOf((await requestLink(student.email)).devLink);
    const results = await Promise.all([1, 2, 3].map(() => api().post('/api/auth/link/verify').send({ token })));
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 410, 410]);
  });

  test('unknown addresses get the same answer and no link', async () => {
    const reply = await requestLink('nobody@example.com');
    assert.equal(reply.ok, true);
    assert.equal(reply.devLink, undefined);
    assert.match(reply.message, /If an account exists/);
    await api().post('/api/auth/link').send({ email: 'not-an-email' }).expect(400);
  });

  test('a student link never grants staff access; a staff link keeps the staff role', async () => {
    const student = await makeAccount('student');
    const s = request.agent(server);
    await s.post('/api/auth/link/verify').send({ token: tokenOf((await requestLink(student.email)).devLink) }).expect(200);
    await s.get('/api/staff/queue').expect(403);
    await s.get('/api/reservations/mine').expect(200);

    const staff = await makeAccount('staff');
    const st = request.agent(server);
    const res = await st.post('/api/auth/link/verify').send({ token: tokenOf((await requestLink(staff.email)).devLink) }).expect(200);
    assert.equal(res.body.account.role, 'staff');
    await st.get('/api/staff/queue').expect(200);
  });

  test('the database stores only a hash of the token', async () => {
    const student = await makeAccount('student');
    const token = tokenOf((await requestLink(student.email)).devLink);
    const { rows } = await pool.query('SELECT token_hash FROM login_links WHERE account_id = $1', [student.id]);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].token_hash, token);
    assert.match(rows[0].token_hash, /^[0-9a-f]{64}$/);
  });
});

describe('E-07 housekeeping', () => {
  test('removes expired sessions and old links; keeps history unless a retention period is set', async () => {
    const student = await makeAccount('student');
    await pool.query(`UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE account_id = $1`, [student.id]);
    await requestLink(student.email);
    await pool.query(`UPDATE login_links SET expires_at = now() - interval '2 days' WHERE account_id = $1`, [student.id]);
    const { rows: [r] } = await pool.query(
      `INSERT INTO reservations(asset_id, account_id, start_at, planned_end_at, status, cancelled_at)
       VALUES ('PRJ-002', $1, now() - interval '400 days', now() - interval '399 days', 'cancelled', now() - interval '400 days')
       RETURNING id`,
      [student.id],
    );

    const kept = await purgeExpired(pool, { historyDays: 0 });
    assert.ok(kept.sessions >= 1 && kept.links >= 1);
    assert.equal(kept.history, 0);
    assert.equal((await pool.query('SELECT 1 FROM reservations WHERE id = $1', [r.id])).rowCount, 1);

    const purged = await purgeExpired(pool, { historyDays: 365 });
    assert.equal(purged.history, 1);
    assert.equal((await pool.query('SELECT 1 FROM reservations WHERE id = $1', [r.id])).rowCount, 0);
  });
});
