// Local PostgreSQL in Docker. Usage: node scripts/db.mjs up | stop | reset | status
import { spawnSync } from 'node:child_process';

const NAME = process.env.DB_CONTAINER || 'campusgear-pg';
const PORT = process.env.DB_PORT || '55432';
const IMAGE = 'postgres:16-alpine';

function docker(args, { quiet = true } = {}) {
  const r = spawnSync('docker', args, { encoding: 'utf8', stdio: quiet ? 'pipe' : 'inherit' });
  if (r.error) fail('Docker is not installed or not in PATH. Install Docker Desktop first.');
  return r;
}

function fail(message) {
  console.error(`\n[db] ${message}\n`);
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function up() {
  if (docker(['info']).status !== 0) fail('Docker is not running. Start Docker Desktop and try again.');

  const state = docker(['inspect', '-f', '{{.State.Running}}', NAME]);
  if (state.status !== 0) {
    console.log(`[db] creating container ${NAME} on port ${PORT}…`);
    const r = docker(['run', '-d', '--name', NAME,
      '-e', 'POSTGRES_USER=campusgear', '-e', 'POSTGRES_PASSWORD=campusgear', '-e', 'POSTGRES_DB=campusgear',
      '-p', `${PORT}:5432`, IMAGE], { quiet: false });
    if (r.status !== 0) fail(`could not start ${NAME} (is port ${PORT} already in use?).`);
  } else if (state.stdout.trim() !== 'true') {
    console.log(`[db] starting container ${NAME}…`);
    if (docker(['start', NAME]).status !== 0) fail(`could not start ${NAME}.`);
  }

  for (let i = 0; i < 60; i++) {
    if (docker(['exec', NAME, 'pg_isready', '-U', 'campusgear', '-d', 'campusgear']).status === 0) break;
    if (i === 59) fail('PostgreSQL did not become ready in 30 seconds.');
    await sleep(500);
  }

  const exists = docker(['exec', NAME, 'psql', '-U', 'campusgear', '-tAc', "SELECT 1 FROM pg_database WHERE datname = 'campusgear_test'"]);
  if (exists.stdout.trim() !== '1') {
    docker(['exec', NAME, 'psql', '-U', 'campusgear', '-c', 'CREATE DATABASE campusgear_test']);
  }
  console.log(`[db] PostgreSQL is ready on localhost:${PORT}`);
}

function stop() {
  docker(['stop', NAME]);
  console.log(`[db] ${NAME} stopped (data kept).`);
}

async function reset() {
  docker(['rm', '-f', NAME]);
  console.log(`[db] ${NAME} removed; recreating with empty data…`);
  await up();
}

function status() {
  const r = docker(['ps', '-a', '--filter', `name=^${NAME}$`, '--format', '{{.Names}}  {{.Status}}  {{.Ports}}']);
  console.log(r.stdout.trim() || `[db] container ${NAME} does not exist yet (run: make db)`);
}

const commands = { up, stop, reset, status };
const cmd = process.argv[2] || 'up';
if (!commands[cmd]) fail(`unknown command "${cmd}". Use: up | stop | reset | status`);
await commands[cmd]();
