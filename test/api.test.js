import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { book, makeAccount, pool, setup, slot, teardown } from './helpers.js';

let server;
let api;
before(async () => ({ server, api } = await setup()));
after(() => teardown(server));

describe('US-01 catalogue', () => {
  test('lists six synthetic assets anonymously and filters by type', async () => {
    const all = await api().get('/api/assets').expect(200);
    assert.equal(all.body.assets.length, 6);
    assert.deepEqual(all.body.types, ['laptop', 'projector']);
    const laptops = await api().get('/api/assets?type=laptop').expect(200);
    assert.ok(laptops.body.assets.length === 3 && laptops.body.assets.every((a) => a.type === 'laptop'));
    const none = await api().get('/api/assets?type=camera').expect(200);
    assert.deepEqual(none.body.assets, []);
  });
});

describe('US-03 accounts and sessions', () => {
  test('register, me, logout, login', async () => {
    const agent = (await import('supertest')).default.agent(server);
    await agent.post('/api/auth/register').send({ email: 'New@Example.com', name: 'New', password: 'longenough' }).expect(201);
    const me = await agent.get('/api/auth/me').expect(200);
    assert.equal(me.body.account.role, 'student');
    assert.equal(me.body.account.email, 'new@example.com');
    await agent.post('/api/auth/logout').send({}).expect(200);
    assert.equal((await agent.get('/api/auth/me')).body.account, null);
    await agent.post('/api/auth/login').send({ email: 'new@example.com', password: 'wrong-pass' }).expect(401);
    await agent.post('/api/auth/login').send({ email: 'new@example.com', password: 'longenough' }).expect(200);
  });

  test('duplicate email and weak password are rejected; self-registration never grants staff', async () => {
    await api().post('/api/auth/register').send({ email: 'new@example.com', name: 'X', password: 'longenough' }).expect(409);
    await api().post('/api/auth/register').send({ email: 'x@example.com', name: 'X', password: 'short' }).expect(400);
    const r = await api().post('/api/auth/register').send({ email: 'y@example.com', name: 'Y', password: 'longenough', role: 'staff' }).expect(201);
    assert.equal(r.body.account.role, 'student');
  });

  test('expired session is not accepted', async () => {
    const s = await makeAccount('student');
    await pool.query('UPDATE sessions SET expires_at = now() - interval \'1 minute\' WHERE account_id = $1', [s.id]);
    await api().get('/api/reservations/mine').set('Cookie', s.cookie).expect(401);
  });

  test('state-changing calls require JSON (CSRF guard)', async () => {
    await api().post('/api/auth/login').type('form').send('email=a&password=b').expect(415);
  });
});

describe('US-02/04/05 availability, reservation, cancellation', () => {
  test('anonymous users cannot reserve; staff cannot reserve as students', async () => {
    await book(api, '', 'LAP-001', slot(0, 10)).expect(401);
    const staff = await makeAccount('staff');
    await book(api, staff.cookie, 'LAP-001', slot(0, 10)).expect(403);
  });

  test('valid booking blocks time; adjacent slot stays valid; cancel reopens', async () => {
    const a = await makeAccount('student');
    const b = await makeAccount('student');
    const res = await book(api, a.cookie, 'PRJ-001', slot(1, 10, 2)).expect(201);
    assert.equal(res.body.reservation.status, 'confirmed');

    const detail = await api().get('/api/assets/PRJ-001').expect(200);
    assert.equal(detail.body.busy.length, 1);
    assert.equal(detail.body.asset.unavailableReason, undefined);

    await book(api, b.cookie, 'PRJ-001', slot(1, 11, 2)).expect(409); // overlap
    await book(api, b.cookie, 'PRJ-001', slot(1, 12, 1)).expect(201); // adjacent [12,13)
    await book(api, a.cookie, 'PRJ-001', slot(2, 10)).expect(409); // one active per asset/student

    const id = res.body.reservation.id;
    await api().post(`/api/reservations/${id}/cancel`).set('Cookie', b.cookie).send({}).expect(404); // not owner
    const c1 = await api().post(`/api/reservations/${id}/cancel`).set('Cookie', a.cookie).send({}).expect(200);
    assert.equal(c1.body.reservation.status, 'cancelled');
    await api().post(`/api/reservations/${id}/cancel`).set('Cookie', a.cookie).send({}).expect(200); // harmless repeat
    const after = await api().get('/api/assets/PRJ-001').expect(200);
    assert.equal(after.body.busy.length, 1); // only b's adjacent booking remains
  });

  test('server enforces loan rules', async () => {
    const s = await makeAccount('student');
    const r = await book(api, s.cookie, 'LAP-002', slot(0, 8)).expect(422);
    assert.equal(r.body.error.code, 'RULE_VIOLATION');
    await book(api, s.cookie, 'NOPE', slot(0, 10)).expect(404);
  });

  test('US-11: retry with the same idempotency key does not create a duplicate', async () => {
    const s = await makeAccount('student');
    const key = 'retry-key-123456';
    const first = await book(api, s.cookie, 'LAP-003', slot(3, 14), { idempotencyKey: key }).expect(201);
    const again = await book(api, s.cookie, 'LAP-003', slot(3, 14), { idempotencyKey: key }).expect(200);
    assert.equal(again.body.reservation.id, first.body.reservation.id);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM reservations WHERE account_id = $1', [s.id]);
    assert.equal(rows[0].n, 1);
  });
});

describe('G2: allocation integrity under concurrency', () => {
  test('20 concurrent request pairs yield zero double confirmations', async () => {
    const pairs = await Promise.all(
      Array.from({ length: 20 }, async () => [await makeAccount('student'), await makeAccount('student')]),
    );
    const results = await Promise.all(
      pairs.map(async ([x, y], i) => {
        const interval = slot(i % 10, 9 + Math.floor(i / 10) * 3, 2);
        const [rx, ry] = await Promise.all([
          book(api, x.cookie, 'PRJ-002', interval),
          book(api, y.cookie, 'PRJ-002', interval),
        ]);
        return [rx.status, ry.status].sort();
      }),
    );
    for (const statuses of results) assert.deepEqual(statuses, [201, 409]);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM reservations r1 JOIN reservations r2
         ON r1.asset_id = r2.asset_id AND r1.id < r2.id
        AND tstzrange(r1.start_at, r1.planned_end_at) && tstzrange(r2.start_at, r2.planned_end_at)
      WHERE r1.status IN ('confirmed','checked_out') AND r2.status IN ('confirmed','checked_out')`,
    );
    assert.equal(rows[0].n, 0);
  });
});
