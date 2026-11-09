import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db.js';
import { notFound } from '../errors.js';
import { publicAsset } from '../serializers.js';

const router = Router();

// US-01: browse and filter (anonymous access allowed).
router.get('/', async (req, res) => {
  const type = typeof req.query.type === 'string' && req.query.type ? req.query.type : null;
  const { rows } = await query(
    `SELECT * FROM assets WHERE ($1::text IS NULL OR type = $1) ORDER BY type, id`,
    [type],
  );
  const types = await query('SELECT DISTINCT type FROM assets ORDER BY type');
  res.json({ assets: rows.map(publicAsset), types: types.rows.map((r) => r.type) });
});

// US-02: details and occupied periods. The borrower's name is shown only to that borrower and to
// desk staff; everyone else sees just that the time is booked.
router.get('/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM assets WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw notFound('Asset');
  const busy = await query(
    `SELECT r.start_at, r.planned_end_at, r.account_id, a.name
       FROM reservations r JOIN accounts a ON a.id = r.account_id
      WHERE r.asset_id = $1 AND r.status IN ('confirmed', 'checked_out')
        AND r.planned_end_at > now() - interval '1 day'
        AND r.start_at < now() + make_interval(days => $2)
      ORDER BY r.start_at`,
    [req.params.id, config.rules.maxLeadDays + 5],
  );
  res.json({
    asset: publicAsset(rows[0]),
    busy: busy.rows.map((b) => {
      const mine = req.account?.id === b.account_id;
      const entry = { start: b.start_at, end: b.planned_end_at, mine };
      if (mine || req.account?.role === 'staff') entry.name = b.name;
      return entry;
    }),
  });
});

export default router;
