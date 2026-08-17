// Integration test: server + built app + CLI against a throwaway DB.
// Proves: project boot from ?project=, SSE pickup of CLI edits, CRUD.
// Usage: node scripts/verify-integration.mjs
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const execFileP = promisify(execFile);
const root = new URL('..', import.meta.url).pathname;
const dir = mkdtempSync(path.join(tmpdir(), 'ml-itest-'));
const env = { ...process.env, ML_DB: path.join(dir, 'test.db'), ML_PORT: '4699' };
const url = 'http://localhost:4699';

const ml = (...args) => execFileP('node', [path.join(root, 'cli/ml.ts'), ...args], { env });

let server;
let browser;
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};

try {
  server = spawn('node', [path.join(root, 'server/index.ts')], { env, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1000));

  // CRUD through the CLI
  await ml('create', 'itest', '-f', path.join(root, 'examples/mosaiq-appointments.mmd'));
  const { stdout: listOut } = await ml('list');
  check('cli create/list', listOut.includes('itest'));

  const id = listOut.trim().split(/\s+/).at(-1);

  // Browser boots the project and renders it
  browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage();
  if (process.env.ML_ITEST_DEBUG) {
    page.on('console', (m) => console.log('  [page]', m.type(), m.text()));
    page.on('pageerror', (e) => console.log('  [pageerror]', String(e)));
  }
  // NOT networkidle0: the SSE stream keeps a connection open forever
  await page.goto(`${url}/?project=${id}`, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForSelector('#diagram svg g', { timeout: 30_000 });
  const label = await page.evaluate(() => document.querySelector('#project-btn').textContent);
  check('browser opens project', label === 'itest', `label="${label}"`);

  // CLI edit is picked up live via SSE
  await execFileP('bash', ['-c', `printf 'pie title Live\\n  "A": 3\\n  "B": 1\\n' | node ${path.join(root, 'cli/ml.ts')} set itest`], { env });
  let synced = false;
  for (let i = 0; i < 20 && !synced; i++) {
    await new Promise((r) => setTimeout(r, 500));
    synced = await page.evaluate(() =>
      document.querySelector('.cm-content')?.textContent?.includes('pie title Live'),
    );
  }
  check('SSE live update from CLI', synced);

  // rename + delete round-trip
  await ml('rename', 'itest', 'itest-2');
  const { stdout: renamed } = await ml('list');
  check('cli rename', renamed.includes('itest-2'));
  await ml('delete', 'itest-2', '-y');
  const { stdout: afterDelete } = await ml('list');
  check('cli delete', !afterDelete.includes('itest-2'));
} catch (err) {
  check('integration run', false, String(err));
} finally {
  await browser?.close();
  server?.kill();
  rmSync(dir, { recursive: true, force: true });
}
process.exit(failures ? 1 : 0);
