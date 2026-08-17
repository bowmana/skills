import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export async function runningServerUrl(): Promise<string | null> {
  const url = `http://localhost:${process.env.ML_PORT ?? 4680}`;
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(500) });
    const body = (await res.json()) as { app?: string };
    return body.app === 'mermaid-lite' ? url : null;
  } catch {
    return null;
  }
}

/** Reuse the running server, or start one detached (needs a dist/ build). */
export async function ensureServer(): Promise<string> {
  const running = await runningServerUrl();
  if (running) return running;
  if (!existsSync(path.join(root, 'dist', 'index.html'))) {
    throw new Error(
      'server is not running and no dist/ build exists. Run `npm run build` in ' +
        `${root} once, or start the dev stack with \`npm run dev\`.`,
    );
  }
  spawn(process.execPath, [path.join(root, 'server', 'index.ts')], {
    detached: true,
    stdio: 'ignore',
  }).unref();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 150));
    const url = await runningServerUrl();
    if (url) return url;
  }
  throw new Error('started the server but it did not come up on time');
}

export function openInBrowser(url: string): void {
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref();
}
