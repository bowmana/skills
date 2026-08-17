// Dev runner: API server (watched) + vite, one Ctrl+C stops both.
import { spawn } from 'node:child_process';

const procs = [
  spawn('node', ['--watch', 'server/index.ts'], { stdio: 'inherit' }),
  spawn('npx', ['vite'], { stdio: 'inherit' }),
];

let exiting = false;
function stop(code) {
  if (exiting) return;
  exiting = true;
  for (const p of procs) p.kill('SIGINT');
  process.exit(code);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
for (const p of procs) p.on('exit', (code) => stop(code ?? 0));
