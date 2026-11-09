import { Router } from 'express';
import { validateInterval } from '../../shared/rules.js';
import { requireRole } from '../auth.js';
import { config } from '../config.js';
import { query, withTransaction } from '../db.js';
import { HttpError, badRequest, conflict, notFound } from '../errors.js';
import { RESERVATION_SELECT, reservation } from '../serializers.js';

const router = Router();

async function findOwnByKey(accountId, key) {
  const { rows } = await query(`${RESERVATION_SELECT} WHERE r.account_id = $1 AND r.idempotency_key = $2`, [accountId, key]);
  return rows[0];
}

async function findById(id) {
  const { rows } = await query(`${RESERVATION_SELECT} WHERE r.id = $1`, [id]);
  return rows[0];
}

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound('Reservation');
  return id;
}

// US-04: create a reservation. The exclusion constraint is the final authority on overlaps.
router.post('/', requireRole('student'), async (req, res) => {
  const { assetId, start, end } = req.body ?? {};
  const key = req.body?.idempotencyKey;
  if (typeof assetId !== 'string' || !assetId) throw badRequest('assetId is required.');
  if (typeof start !== 'string' || typeof end !== 'string') throw badRequest('start and end are required ISO date-times.');
  if (key !== undefined && (typeof key !== 'string' || key.length < 8 || key.length > 100)) {
    throw badRequest('idempotencyKey must be 8–100 characters.');
  }
  const startAt = new Date(start);
  const endAt = new Date(end);
  const problems = validateInterval(startAt, endAt, new Date(), config.rules);
  if (problems.length) throw new HttpError(422, 'RULE_VIOLATION', problems[0], problems);

  const accountId = req.account.id;
  if (key) {
    const existing = await findOwnByKey(accountId, key);
    if (existing) return res.status(200).json({ reservation: reservation(existing), replayed: true });
  }

  let id;
  try {
    id = await withTransaction(async (client) => {
      // FOR SHARE: a concurrent "mark unavailable" waits for us (and vice versa).
      const asset = await client.query('SELECT status FROM assets WHERE id = $1 FOR SHARE', [assetId]);
      if (!asset.rows[0]) throw notFound('Asset');
      if (asset.rows[0].status !== 'available') {
        throw conflict('ASSET_UNAVAILABLE', 'This asset is currently unavailable for new bookings.');
      }
      const { rows } = await client.query(
        `INSERT INTO reservations(asset_id, account_id, start_at, planned_end_at, status, idempotency_key)
         VALUES ($1, $2, $3, $4, 'confirmed', $5) RETURNING id`,
        [assetId, accountId, startAt, endAt, key ?? null],
      );
      return rows[0].id;
    });
  } catch (err) {
    if (err.code === '23P01') {
      throw conflict('SLOT_TAKEN', 'Someone has just booked part of this time. Please choose another period.');
    }
    if (err.code === '23505' && err.constraint === 'reservations_idempotency') {
      const existing = await findOwnByKey(accountId, key);
      return res.status(200).json({ reservation: reservation(existing), replayed: true });
    }
    if (err.code === '23505' && err.constraint === 'reservations_one_active_per_student') {
      throw conflict('ALREADY_ACTIVE', 'You already have an active reservation for this asset.');
    }
    throw err;
  }
  res.status(201).json({ reservation: reservation(await findById(id)) });
});

// Active reservations of the signed-in student.
router.get('/mine', requireRole('student'), async (req, res) => {
  const { rows } = await query(
    `${RESERVATION_SELECT} WHERE r.account_id = $1 AND r.status IN ('confirmed', 'checked_out') ORDER BY r.start_at`,
    [req.account.id],
  );
  res.json({ reservations: rows.map((r) => reservation(r)) });
});

// US-10: own Returned/Cancelled history only.
router.get('/history', requireRole('student'), async (req, res) => {
  const { rows } = await query(
    `${RESERVATION_SELECT} WHERE r.account_id = $1 AND r.status IN ('returned', 'cancelled')
      ORDER BY COALESCE(r.returned_at, r.cancelled_at) DESC, r.id DESC`,
    [req.account.id],
  );
  res.json({ reservations: rows.map((r) => reservation(r)) });
});

// US-05: owner cancels before checkout; staff may cancel explicitly (e.g. faulty asset).
// Repeating the request is harmless.
router.post('/:id/cancel', requireRole('student', 'staff'), async (req, res) => {
  const id = parseId(req.params.id);
  const isStaff = req.account.role === 'staff';
  const { rowCount } = await query(
    `UPDATE reservations SET status = 'cancelled', cancelled_at = now(), cancelled_by = $2
      WHERE id = $1 AND status = 'confirmed' AND (account_id = $2 OR $3)`,
    [id, req.account.id, isStaff],
  );
  const row = await findById(id);
  if (!row || (!isStaff && row.account_id !== req.account.id)) throw notFound('Reservation');
  if (rowCount === 0 && row.status !== 'cancelled') {
    throw conflict('INVALID_TRANSITION', `A reservation that is ${row.status.replace('_', ' ')} cannot be cancelled.`);
  }
  res.json({ reservation: reservation(row, { includeStudent: isStaff }) });
});

export default router;
