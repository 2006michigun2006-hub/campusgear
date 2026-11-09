// Runs the API (auto-restart on change) and the Vite dev server together.
// Ctrl+C stops both; if one exits, the other is stopped too.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const viteBin = path.join(path.dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');

const procs = [
  { name: 'api', color: 36, args: ['--watch', 'server/index.js'] },
  { name: 'web', color: 35, args: [viteBin] },
];

let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const p of procs) if (p.child && p.child.exitCode === null) p.child.kill();
  setTimeout(() => process.exit(code), 500);
}

for (const p of procs) {
  const prefix = `\x1b[${p.color}m[${p.name}]\x1b[0m `;
  const env = process.env.NO_COLOR ? process.env : { ...process.env, FORCE_COLOR: '1' };
  p.child = spawn(process.execPath, p.args, { env });
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk;
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) out.write(prefix + line + '\n');
    });
  };
  pipe(p.child.stdout, process.stdout);
  pipe(p.child.stderr, process.stderr);
  p.child.on('exit', (code) => {
    if (!stopping) {
      console.log(`${prefix}exited with code ${code}; stopping the other process.`);
      stopAll(code ?? 1);
    }
  });
}

console.log('\nCampusGear dev: open http://localhost:5173  (API on http://localhost:3000). Ctrl+C to stop.\n');
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
