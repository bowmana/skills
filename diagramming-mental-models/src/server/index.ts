import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { dbPath } from './db.ts';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(root, 'dist');

const app = createApp();

// Outside dev (vite serves the frontend there), serve the built app too.
if (existsSync(dist)) {
  const relDist = path.relative(process.cwd(), dist) || '.';
  app.use('*', serveStatic({ root: relDist }));
  app.get('*', serveStatic({ path: path.join(relDist, 'index.html') }));
}

const port = Number(process.env.ML_PORT ?? 4680);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`mermaid-lite server on http://localhost:${info.port}`);
  console.log(`db: ${dbPath()}`);
  if (!existsSync(dist)) {
    console.log('(no dist/ build found — API only; use vite dev or run `npm run build`)');
  }
});
