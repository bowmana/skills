import type { Project, ProjectSummary, ProjectPatch } from '../shared/types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function listProjects(): Promise<ProjectSummary[]> {
  return fetch('/api/projects').then((r) => json<ProjectSummary[]>(r));
}

export function getProject(id: string): Promise<Project> {
  return fetch(`/api/projects/${id}`).then((r) => json<Project>(r));
}

export function createProject(init: {
  name?: string;
  code?: string;
  theme?: string;
}): Promise<Project> {
  return fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(init),
  }).then((r) => json<Project>(r));
}

export function patchProject(
  id: string,
  patch: ProjectPatch,
): Promise<{ rev: number; updatedAt: number }> {
  return fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then((r) => json<{ rev: number; updatedAt: number }>(r));
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) throw new Error(`${res.status} ${res.statusText}`);
}

/** SSE subscription; EventSource reconnects automatically. */
export function subscribe(onChange: (projects: ProjectSummary[]) => void): void {
  const es = new EventSource('/api/events');
  es.addEventListener('change', (e) => {
    try {
      onChange(JSON.parse((e as MessageEvent).data) as ProjectSummary[]);
    } catch {
      // malformed event — ignore
    }
  });
}
