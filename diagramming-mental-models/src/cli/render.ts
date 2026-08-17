import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getProject } from '../server/db.ts';
import { runningServerUrl } from './browser.ts';

export interface RenderOpts {
  out?: string;
  theme?: string;
  scale: number;
  url?: string;
  stdinCode?: string;
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function ephemeralAppServer(): Promise<{ url: string; close: () => void }> {
  const dist = path.join(root, 'dist');
  if (!existsSync(path.join(dist, 'index.html'))) {
    throw new Error(
      'no built app found (dist/). Run `npm run build` in the mermaid-lite repo, ' +
        'start `ml serve`, or pass --url http://localhost:5173 for a vite dev server.',
    );
  }
  const { Hono } = await import('hono');
  const { serve } = await import('@hono/node-server');
  const { serveStatic } = await import('@hono/node-server/serve-static');
  const relDist = path.relative(process.cwd(), dist) || '.';
  const app = new Hono();
  app.use('*', serveStatic({ root: relDist }));
  const server = serve({ fetch: app.fetch, port: 0 });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('could not bind port');
  return { url: `http://localhost:${address.port}`, close: () => server.close() };
}

export async function renderCmd(source: string | undefined, opts: RenderOpts): Promise<void> {
  // Resolve code + theme: stdin ('-' or piped), a .mmd file, or a project.
  let code: string;
  let theme = opts.theme ?? 'default';
  if (opts.stdinCode !== undefined && (source === '-' || source === undefined)) {
    code = opts.stdinCode;
  } else if (source && existsSync(source)) {
    code = readFileSync(source, 'utf8');
  } else if (source) {
    const project = getProject(source);
    if (!project) throw new Error(`no file or project named "${source}"`);
    code = project.code;
    if (!opts.theme) theme = project.theme;
  } else {
    throw new Error('nothing to render: pass a project, a .mmd file, or pipe code on stdin');
  }

  const format = opts.out?.toLowerCase().endsWith('.png') ? 'png' : 'svg';
  if (format === 'png' && !opts.out) throw new Error('PNG output requires -o <file.png>');

  let close: (() => void) | null = null;
  let url = opts.url ?? (await runningServerUrl());
  if (!url) {
    const ephemeral = await ephemeralAppServer();
    url = ephemeral.url;
    close = ephemeral.close;
  }

  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: process.env.ML_CHROME ?? '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`${url}/?headless=1`, { waitUntil: 'networkidle0', timeout: 60_000 });
    await page.waitForFunction('window.__mermaidLite !== undefined', { timeout: 30_000 });
    const result = (await page.evaluate(
      async (args: { code: string; theme: string; format: string; scale: number }) => {
        // runs in the browser page; globalThis === window there
        const hook = (globalThis as unknown as {
          __mermaidLite: {
            renderSvg: (code: string, theme: string) => Promise<string>;
            renderPng: (code: string, theme: string, scale: number) => Promise<string>;
          };
        }).__mermaidLite;
        try {
          const data =
            args.format === 'png'
              ? await hook.renderPng(args.code, args.theme, args.scale)
              : await hook.renderSvg(args.code, args.theme);
          return { ok: true as const, data };
        } catch (err) {
          return { ok: false as const, error: String((err as Error)?.message ?? err) };
        }
      },
      { code, theme, format, scale: opts.scale },
    )) as { ok: true; data: string } | { ok: false; error: string };

    if (!result.ok) throw new Error(`mermaid: ${result.error}`);

    if (format === 'png') {
      const base64 = result.data.replace(/^data:image\/png;base64,/, '');
      writeFileSync(opts.out!, Buffer.from(base64, 'base64'));
      console.error(`wrote ${opts.out}`);
    } else if (opts.out) {
      writeFileSync(opts.out, result.data);
      console.error(`wrote ${opts.out}`);
    } else {
      process.stdout.write(result.data);
    }
  } finally {
    await browser.close();
    close?.();
  }
}
