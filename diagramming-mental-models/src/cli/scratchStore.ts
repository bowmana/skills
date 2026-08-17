import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { dbPath } from '../server/db.ts';

// Scratch diagrams live only in the browser URL hash; persist what `ml
// scratch` opens so `ml show --scratch` can review it later. In-app edits to
// a scratch page are NOT captured (in-memory only) — documented limitation.

function scratchDir(): string {
  return path.join(path.dirname(dbPath()), 'scratch');
}

export function saveScratch(code: string): void {
  const dir = scratchDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'last.mmd'), code);
  writeFileSync(path.join(dir, `${Date.now()}.mmd`), code);
  // keep a short history
  const stamped = readdirSync(dir)
    .filter((f) => /^\d+\.mmd$/.test(f))
    .sort();
  for (const old of stamped.slice(0, -20)) rmSync(path.join(dir, old), { force: true });
}

export function readLastScratch(): string | null {
  const file = path.join(scratchDir(), 'last.mmd');
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}
