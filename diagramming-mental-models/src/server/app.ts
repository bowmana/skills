import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  dataVersion,
  NameTakenError,
} from './db.ts';
import type { ProjectPatch } from '../shared/types.ts';

type SSEClient = { send: (data: string) => Promise<void> };

const clients = new Set<SSEClient>();
let poller: ReturnType<typeof setInterval> | null = null;
let lastDataVersion = 0;

function broadcast(): void {
  const payload = JSON.stringify(listProjects());
  for (const client of clients) {
    client.send(payload).catch(() => clients.delete(client));
  }
}

// PRAGMA data_version only moves when a DIFFERENT connection commits, so this
// is exactly "did the CLI (or anything else) write?". Runs only while the
// browser is listening.
function ensurePoller(): void {
  if (poller) return;
  lastDataVersion = dataVersion();
  poller = setInterval(() => {
    if (clients.size === 0) {
      clearInterval(poller!);
      poller = null;
      return;
    }
    const v = dataVersion();
    if (v !== lastDataVersion) {
      lastDataVersion = v;
      broadcast();
    }
  }, 1000);
}

export function createApp(): Hono {
  const app = new Hono();

  app.get('/api/health', (c) => c.json({ ok: true, app: 'mermaid-lite' }));

  app.get('/api/projects', (c) => c.json(listProjects()));

  app.post('/api/projects', async (c) => {
    const body = await c.req.json<{ name?: string; code?: string; theme?: string }>().catch(() => ({}));
    try {
      const project = createProject(body);
      broadcast();
      return c.json(project, 201);
    } catch (err) {
      if (err instanceof NameTakenError) return c.json({ error: err.message }, 409);
      return c.json({ error: String(err) }, 400);
    }
  });

  app.get('/api/projects/:id', (c) => {
    const project = getProject(c.req.param('id'));
    return project ? c.json(project) : c.json({ error: 'not found' }, 404);
  });

  app.patch('/api/projects/:id', async (c) => {
    const patch = await c.req.json<ProjectPatch>().catch(() => null);
    if (!patch) return c.json({ error: 'invalid JSON body' }, 400);
    try {
      const result = updateProject(c.req.param('id'), patch);
      if (!result) return c.json({ error: 'not found' }, 404);
      broadcast();
      return c.json(result);
    } catch (err) {
      if (err instanceof NameTakenError) return c.json({ error: err.message }, 409);
      return c.json({ error: String(err) }, 400);
    }
  });

  app.delete('/api/projects/:id', (c) => {
    if (!deleteProject(c.req.param('id'))) return c.json({ error: 'not found' }, 404);
    broadcast();
    return c.body(null, 204);
  });

  app.get('/api/events', (c) =>
    streamSSE(c, async (stream) => {
      const client: SSEClient = {
        send: (data) => stream.writeSSE({ event: 'change', data }),
      };
      clients.add(client);
      ensurePoller();
      await client.send(JSON.stringify(listProjects()));
      // keepalive until the client disconnects
      while (!stream.aborted) {
        await stream.sleep(25_000);
        await stream.writeSSE({ event: 'ping', data: '' }).catch(() => {});
      }
      clients.delete(client);
    }),
  );

  return app;
}
