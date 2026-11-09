// Data retention (E-07). Expired sessions and sign-in links are always removed.
// Loan history is kept unless HISTORY_RETENTION_DAYS is set, because the retention period is not
// yet approved by the campus (see docs/privacy-and-retention.md).
import { config } from './config.js';
import { pool } from './db.js';

export async function purgeExpired(db = pool, { historyDays = config.historyRetentionDays } = {}) {
  const sessions = await db.query('DELETE FROM sessions WHERE expires_at < now()');
  const links = await db.query(`DELETE FROM login_links WHERE expires_at < now() - interval '1 day'`);
  let history = { rowCount: 0 };
  if (historyDays > 0) {
    history = await db.query(
      `DELETE FROM reservations
        WHERE status IN ('returned', 'cancelled')
          AND coalesce(returned_at, cancelled_at, planned_end_at) < now() - make_interval(days => $1)`,
      [historyDays],
    );
  }
  return { sessions: sessions.rowCount, links: links.rowCount, history: history.rowCount };
}

/** Runs purgeExpired now and then hourly; the timer never keeps the process alive. */
export function scheduleHousekeeping() {
  const run = () => purgeExpired()
    .then((n) => {
      if (n.sessions || n.links || n.history) console.log(`[housekeeping] removed ${JSON.stringify(n)}`);
    })
    .catch((err) => console.error('[housekeeping] failed:', err.message));
  run();
  setInterval(run, 3600000).unref();
}
