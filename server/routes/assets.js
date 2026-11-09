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

// US-02: details and occupied periods. No personal data is exposed.
router.get('/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM assets WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw notFound('Asset');
  const busy = await query(
    `SELECT start_at, planned_end_at FROM reservations
      WHERE asset_id = $1 AND status IN ('confirmed', 'checked_out')
        AND planned_end_at > now() - interval '1 day'
        AND start_at < now() + make_interval(days => $2)
      ORDER BY start_at`,
    [req.params.id, config.rules.maxLeadDays + 5],
  );
  res.json({
    asset: publicAsset(rows[0]),
    busy: busy.rows.map((b) => ({ start: b.start_at, end: b.planned_end_at })),
  });
});

export default router;
