import { Router } from 'express';
import { requireRole } from '../auth.js';
import { query, withTransaction } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { RESERVATION_SELECT, reservation, staffAsset } from '../serializers.js';

const router = Router();
router.use(requireRole('staff'));

const asStaffView = (rows) => rows.map((r) => reservation(r, { includeStudent: true }));

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw notFound('Reservation');
  return id;
}

// US-06: confirmed bookings ordered by pickup time; cancelled ones excluded.
router.get('/queue', async (_req, res) => {
  const { rows } = await query(`${RESERVATION_SELECT} WHERE r.status = 'confirmed' ORDER BY r.start_at, r.id`);
  res.json({ reservations: asStaffView(rows) });
});

// Loans currently out, soonest planned return first.
router.get('/on-loan', async (_req, res) => {
  const { rows } = await query(`${RESERVATION_SELECT} WHERE r.status = 'checked_out' ORDER BY r.planned_end_at, r.id`);
  res.json({ reservations: asStaffView(rows) });
});

// US-09: checked-out loans past their planned end, oldest first. No fees or messages are triggered.
router.get('/overdue', async (_req, res) => {
  const { rows } = await query(
    `${RESERVATION_SELECT} WHERE r.status = 'checked_out' AND r.planned_end_at < now() ORDER BY r.planned_end_at, r.id`,
  );
  res.json({ reservations: asStaffView(rows) });
});

async function transition(id, staffId, from, sql) {
  const { rowCount } = await query(sql, [id, staffId]);
  const { rows } = await query(`${RESERVATION_SELECT} WHERE r.id = $1`, [id]);
  const row = rows[0];
  if (!row) throw notFound('Reservation');
  if (rowCount === 0) {
    throw conflict('INVALID_TRANSITION', `Only a ${from.replace('_', ' ')} reservation can do this; it is ${row.status.replace('_', ' ')}.`);
  }
  return row;
}

// US-07: Confirmed → Checked out (blocked while the asset is marked unavailable).
router.post('/reservations/:id/checkout', async (req, res) => {
  const id = parseId(req.params.id);
  const { rows: assetRows } = await query(
    `SELECT a.status FROM reservations r JOIN assets a ON a.id = r.asset_id WHERE r.id = $1`,
    [id],
  );
  if (assetRows[0]?.status === 'unavailable') {
    throw conflict('ASSET_UNAVAILABLE', 'The asset is marked unavailable; resolve or cancel this booking instead.');
  }
  const row = await transition(id, req.account.id, 'confirmed',
    `UPDATE reservations SET status = 'checked_out', checked_out_at = now(), checked_out_by = $2
      WHERE id = $1 AND status = 'confirmed'`);
  res.json({ reservation: reservation(row, { includeStudent: true }) });
});

// US-07: Checked out → Returned. planned_end_at is never changed; returning early releases
// the remaining time because returned rows leave the overlap constraint.
router.post('/reservations/:id/return', async (req, res) => {
  const id = parseId(req.params.id);
  const row = await transition(id, req.account.id, 'checked_out',
    `UPDATE reservations SET status = 'returned', returned_at = now(), returned_by = $2
      WHERE id = $1 AND status = 'checked_out'`);
  res.json({ reservation: reservation(row, { includeStudent: true }) });
});

const ASSET_WITH_AFFECTED = `
  SELECT a.*, (SELECT count(*) FROM reservations r WHERE r.asset_id = a.id AND r.status = 'confirmed'
                 AND a.status = 'unavailable') AS affected_count
    FROM assets a`;

router.get('/assets', async (_req, res) => {
  const { rows } = await query(`${ASSET_WITH_AFFECTED} ORDER BY a.type, a.id`);
  res.json({ assets: rows.map(staffAsset) });
});

router.get('/assets/:id/affected', async (req, res) => {
  const { rows } = await query(
    `${RESERVATION_SELECT} WHERE r.asset_id = $1 AND r.status = 'confirmed' ORDER BY r.start_at`,
    [req.params.id],
  );
  res.json({ reservations: asStaffView(rows) });
});

// US-08: mark an asset unavailable (or available again). Existing bookings are kept and flagged.
router.post('/assets/:id/status', async (req, res) => {
  const { status } = req.body ?? {};
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const notice = typeof req.body?.publicNotice === 'string' ? req.body.publicNotice.trim() : '';
  if (!['available', 'unavailable'].includes(status)) throw badRequest('status must be "available" or "unavailable".');
  if (status === 'unavailable' && !reason) throw badRequest('Give a staff-only reason for marking the asset unavailable.');
  if (reason.length > 500 || notice.length > 200) throw badRequest('Reason or notice is too long.');

  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE assets SET status = $2, unavailable_reason = $3, public_notice = $4, status_changed_at = now()
        WHERE id = $1`,
      [req.params.id, status, status === 'unavailable' ? reason : null,
        status === 'unavailable' ? notice || 'Temporarily unavailable for maintenance.' : null],
    );
    if (rowCount === 0) throw notFound('Asset');
  });
  const asset = await query(`${ASSET_WITH_AFFECTED} WHERE a.id = $1`, [req.params.id]);
  const affected = await query(
    `${RESERVATION_SELECT} WHERE r.asset_id = $1 AND r.status = 'confirmed' ORDER BY r.start_at`,
    [req.params.id],
  );
  res.json({ asset: staffAsset(asset.rows[0]), affected: asStaffView(affected.rows) });
});

export default router;
