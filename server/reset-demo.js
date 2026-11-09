// Pilot reset (E-05, E-09): wipes every account, booking, session and sign-in link, returns all
// assets to service and re-runs the seed. Synthetic data only; never point this at real data.
//   npm run demo:reset -- --yes
import { pathToFileURL } from 'node:url';
import { pool } from './db.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';

export async function resetDemo(db = pool) {
  await migrate(db);
  await db.query('TRUNCATE reservations, login_links, sessions, accounts RESTART IDENTITY CASCADE');
  await db.query(`UPDATE assets SET status = 'available', unavailable_reason = NULL, public_notice = NULL, status_changed_at = NULL`);
  await seed(db);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv.includes('--yes')) {
    console.error('This deletes all accounts and bookings in the database at DATABASE_URL.');
    console.error('Run again with --yes to confirm:  npm run demo:reset -- --yes');
    process.exit(1);
  }
  resetDemo()
    .then(() => {
      console.log('Demo data reset: synthetic assets, staff and demo student re-created.');
      return pool.end();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
