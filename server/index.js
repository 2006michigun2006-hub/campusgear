import { createApp } from './app.js';
import { config } from './config.js';
import { scheduleHousekeeping } from './housekeeping.js';
import { pool } from './db.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';

async function main() {
  await migrate();
  if (config.seedDemo) await seed();
  scheduleHousekeeping();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`CampusGear listening on port ${config.port} (campus time zone ${config.rules.timeZone})`);
  });
  const shutdown = () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start CampusGear:', err);
  process.exit(1);
});
