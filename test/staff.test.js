import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { book, makeAccount, pool, setup, slot, teardown } from './helpers.js';

let server;
let api;
let staff;
let student;
before(async () => {
  ({ server, api } = await setup());
  staff = await makeAccount('staff', 'Desk');
  student = await makeAccount('student', 'Stu');
});
after(() => teardown(server));

const post = (path, cookie, body = {}) => api().post(path).set('Cookie', cookie).send(body);

describe('role matrix for staff endpoints', () => {
  for (const path of ['/api/staff/queue', '/api/staff/overdue', '/api/staff/on-loan', '/api/staff/assets']) {
    test(`${path}: anonymous 401, student 403, staff 200`, async () => {
      await api().get(path).expect(401);
      await api().get(path).set('Cookie', student.cookie).expect(403);
      await api().get(path).set('Cookie', staff.cookie).expect(200);
    });
  }
});

describe('role matrix for student endpoints', () => {
  for (const path of ['/api/reservations/mine', '/api/reservations/history']) {
    test(`${path}: anonymous 401, staff 403, student 200`, async () => {
      await api().get(path).expect(401);
      await api().get(path).set('Cookie', staff.cookie).expect(403);
      await api().get(path).set('Cookie', student.cookie).expect(200);
    });
  }
});

describe('US-06/07 queue, checkout, return', () => {
  test('queue is ordered by pickup and excludes cancelled', async () => {
    const other = await makeAccount('student');
    const late = await book(api, student.cookie, 'LAP-001', slot(2, 10)).expect(201);
    const early = await book(api, other.cookie, 'LAP-001', slot(1, 10)).expect(201);
    const gone = await book(api, other.cookie, 'LAP-002', slot(0, 10)).expect(201);
    await post(`/api/reservations/${gone.body.reservation.id}/cancel`, other.cookie).expect(200);

    const q = await api().get('/api/staff/queue').set('Cookie', staff.cookie).expect(200);
    const ids = q.body.reservations.map((r) => r.id);
    assert.deepEqual(ids, [early.body.reservation.id, late.body.reservation.id]);
    assert.equal(q.body.reservations[0].student.name.length > 0, true);
  });

  test('valid transitions only; original end preserved; early return releases time', async () => {
    const r = (await book(api, student.cookie, 'PRJ-003', slot(4, 9, 6)).expect(201)).body.reservation;
    await post(`/api/staff/reservations/${r.id}/return`, staff.cookie).expect(409); // not checked out yet
    await post(`/api/staff/reservations/${r.id}/checkout`, student.cookie).expect(403);
    const out = await post(`/api/staff/reservations/${r.id}/checkout`, staff.cookie).expect(200);
    assert.equal(out.body.reservation.status, 'checked_out');
    await post(`/api/staff/reservations/${r.id}/checkout`, staff.cookie).expect(409);
    await post(`/api/reservations/${r.id}/cancel`, student.cookie).expect(409); // cannot cancel after checkout

    const ret = await post(`/api/staff/reservations/${r.id}/return`, staff.cookie).expect(200);
    assert.equal(ret.body.reservation.status, 'returned');
    assert.equal(ret.body.reservation.plannedEnd, r.plannedEnd);
    assert.equal(ret.body.reservation.returnedEarly, true);
    // The released interval can be booked by someone else.
    const other = await makeAccount('student');
    await book(api, other.cookie, 'PRJ-003', slot(4, 12, 2)).expect(201);

    const history = await api().get('/api/reservations/history').set('Cookie', student.cookie).expect(200);
    assert.ok(history.body.reservations.some((h) => h.id === r.id && h.status === 'returned'));
  });
});

describe('US-09 overdue list', () => {
  test('only checked-out loans past planned end, oldest first', async () => {
    const other = await makeAccount('student');
    const insert = (asset, startH, endH, status, accountId = student.id) => pool.query(
      `INSERT INTO reservations(asset_id, account_id, start_at, planned_end_at, status)
       VALUES ($1, $2, now() + make_interval(hours => $3), now() + make_interval(hours => $4), $5) RETURNING id`,
      [asset, accountId, startH, endH, status],
    ).then((r) => r.rows[0].id);
    const older = await insert('LAP-003', -50, -48, 'checked_out');
    const newer = await insert('PRJ-001', -30, -2, 'checked_out', other.id);
    await insert('PRJ-002', -5, 3, 'checked_out', other.id); // still within loan
    await insert('LAP-002', -60, -58, 'returned');
    const res = await api().get('/api/staff/overdue').set('Cookie', staff.cookie).expect(200);
    assert.deepEqual(res.body.reservations.map((r) => r.id), [older, newer]);
    assert.ok(res.body.reservations.every((r) => r.overdue));

    const late = await post(`/api/staff/reservations/${older}/return`, staff.cookie).expect(200);
    assert.equal(late.body.reservation.returnedLate, true);
  });
});

describe('US-08 maintenance unavailability', () => {
  test('blocks new bookings, flags existing ones and keeps the reason private', async () => {
    const existing = (await book(api, student.cookie, 'PRJ-002', slot(5, 10)).expect(201)).body.reservation;
    await post('/api/staff/assets/PRJ-002/status', staff.cookie, { status: 'unavailable' }).expect(400);
    const res = await post('/api/staff/assets/PRJ-002/status', staff.cookie, {
      status: 'unavailable', reason: 'Lamp failure, ticket #42', publicNotice: 'Under repair',
    }).expect(200);
    assert.equal(res.body.affected.length, 1);
    assert.equal(res.body.asset.unavailableReason, 'Lamp failure, ticket #42');
    await post('/api/staff/assets/PRJ-002/status', student.cookie, { status: 'available' }).expect(403);

    const other = await makeAccount('student');
    const blocked = await book(api, other.cookie, 'PRJ-002', slot(6, 10)).expect(409);
    assert.equal(blocked.body.error.code, 'ASSET_UNAVAILABLE');

    const pub = await api().get('/api/assets/PRJ-002').expect(200);
    assert.equal(pub.body.asset.status, 'unavailable');
    assert.equal(pub.body.asset.publicNotice, 'Under repair');
    assert.ok(!JSON.stringify(pub.body).includes('Lamp failure'));

    const mine = await api().get('/api/reservations/mine').set('Cookie', student.cookie).expect(200);
    const flagged = mine.body.reservations.find((r) => r.id === existing.id);
    assert.equal(flagged.status, 'confirmed');
    assert.equal(flagged.assetUnavailable, true);
    await post(`/api/staff/reservations/${existing.id}/checkout`, staff.cookie).expect(409);

    await post('/api/staff/assets/PRJ-002/status', staff.cookie, { status: 'available' }).expect(200);
    await book(api, other.cookie, 'PRJ-002', slot(6, 10)).expect(201);
  });
});

describe('US-10 history privacy', () => {
  test('a student only sees their own Returned/Cancelled records', async () => {
    const other = await makeAccount('student');
    const res = await api().get('/api/reservations/history').set('Cookie', other.cookie).expect(200);
    assert.deepEqual(res.body.reservations, []);
  });
});
