// Headless smoke test: load each example through the real app and confirm it
// renders without errors. Usage: node scripts/verify.mjs [devServerUrl]
import puppeteer from 'puppeteer-core';
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';

const url = process.argv[2] ?? 'http://localhost:5173';
const examplesDir = new URL('../examples/', import.meta.url).pathname;
const shotsDir = new URL('../verify-shots/', import.meta.url).pathname;
await mkdir(shotsDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1800,1100'],
  defaultViewport: { width: 1800, height: 1100 },
});

let failures = 0;
for (const file of (await readdir(examplesDir)).filter((f) => f.endsWith('.mmd'))) {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  await page.goto(`${url}/?src=/examples/${file}`, {
    waitUntil: 'networkidle0',
    timeout: 60_000,
  });

  let ok = true;
  let detail = '';
  try {
    await page.waitForSelector('#diagram svg g', { timeout: 30_000 });
    await new Promise((r) => setTimeout(r, 1500)); // let fonts/panzoom settle
    const result = await page.evaluate(() => ({
      errorHidden: document.querySelector('#error-bar').hidden,
      errorText: document.querySelector('#error-text').textContent,
      nodeCount: document.querySelectorAll('#diagram svg .node, #diagram svg g').length,
      stale: document.querySelector('#diagram').classList.contains('stale'),
    }));
    ok = result.errorHidden && !result.stale && result.nodeCount > 0;
    detail = ok
      ? `${result.nodeCount} svg groups`
      : `error="${result.errorText}" stale=${result.stale}`;
  } catch (e) {
    ok = false;
    detail = String(e);
  }
  if (consoleErrors.length) detail += ` | pageerrors: ${consoleErrors.join('; ')}`;

  await page.screenshot({ path: path.join(shotsDir, file.replace('.mmd', '.png')) });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${file} — ${detail}`);
  if (!ok) failures++;
  await page.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
