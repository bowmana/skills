import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import type { Project, ProjectSummary, ProjectPatch } from '../shared/types.ts';

export function dbPath(): string {
  if (process.env.ML_DB) return process.env.ML_DB;
  const dataHome = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), '.local/share');
  return path.join(dataHome, 'mermaid-lite', 'projects.db');
}

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  const file = dbPath();
  mkdirSync(path.dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
      code        TEXT NOT NULL DEFAULT '',
      theme       TEXT NOT NULL DEFAULT 'default',
      annotations TEXT NOT NULL DEFAULT '[]',
      pan_zoom    TEXT,
      rev         INTEGER NOT NULL DEFAULT 1,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    )
  `);
  return db;
}

interface Row {
  id: string;
  name: string;
  code: string;
  theme: string;
  annotations: string;
  pan_zoom: string | null;
  rev: number;
  created_at: number;
  updated_at: number;
}

function toProject(row: Row): Project {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    theme: row.theme,
    annotations: JSON.parse(row.annotations),
    panZoom: row.pan_zoom ? JSON.parse(row.pan_zoom) : null,
    rev: row.rev,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProjects(): ProjectSummary[] {
  const rows = getDb()
    .prepare('SELECT id, name, rev, created_at, updated_at FROM projects ORDER BY updated_at DESC')
    .all() as unknown as Omit<Row, 'code' | 'theme' | 'annotations' | 'pan_zoom'>[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    rev: r.rev,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/** Resolve by exact id first, then case-insensitive name. */
export function getProject(idOrName: string): Project | null {
  const d = getDb();
  const byId = d.prepare('SELECT * FROM projects WHERE id = ?').get(idOrName) as unknown as
    | Row
    | undefined;
  if (byId) return toProject(byId);
  const byName = d
    .prepare('SELECT * FROM projects WHERE name = ? COLLATE NOCASE')
    .get(idOrName) as unknown as Row | undefined;
  return byName ? toProject(byName) : null;
}

export function uniqueName(base: string): string {
  const d = getDb();
  const exists = (n: string) =>
    d.prepare('SELECT 1 FROM projects WHERE name = ? COLLATE NOCASE').get(n) !== undefined;
  if (!exists(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base} ${i}`;
    if (!exists(candidate)) return candidate;
  }
}

export class NameTakenError extends Error {
  constructor(name: string) {
    super(`a project named "${name}" already exists`);
  }
}

export function createProject(
  init: { name?: string; code?: string; theme?: string } = {},
): Project {
  const d = getDb();
  const now = Date.now();
  const id = randomUUID();
  const name = init.name ? init.name.trim() : uniqueName('Untitled');
  if (!name) throw new Error('project name cannot be empty');
  try {
    d.prepare(
      'INSERT INTO projects (id, name, code, theme, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(id, name, init.code ?? '', init.theme ?? 'default', now, now);
  } catch (err) {
    if (String(err).includes('UNIQUE')) throw new NameTakenError(name);
    throw err;
  }
  return getProject(id)!;
}

export function updateProject(
  id: string,
  patch: ProjectPatch,
): { rev: number; updatedAt: number } | null {
  const d = getDb();
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error('project name cannot be empty');
    sets.push('name = ?');
    values.push(name);
  }
  if (patch.code !== undefined) {
    sets.push('code = ?');
    values.push(patch.code);
  }
  if (patch.theme !== undefined) {
    sets.push('theme = ?');
    values.push(patch.theme);
  }
  if (patch.annotations !== undefined) {
    sets.push('annotations = ?');
    values.push(JSON.stringify(patch.annotations));
  }
  if (patch.panZoom !== undefined) {
    sets.push('pan_zoom = ?');
    values.push(patch.panZoom ? JSON.stringify(patch.panZoom) : null);
  }
  if (sets.length === 0) {
    const row = getProject(id);
    return row ? { rev: row.rev, updatedAt: row.updatedAt } : null;
  }
  const now = Date.now();
  sets.push('rev = rev + 1', 'updated_at = ?');
  values.push(now, id);
  let result;
  try {
    result = d
      .prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`)
      .run(...values);
  } catch (err) {
    if (String(err).includes('UNIQUE')) throw new NameTakenError(patch.name ?? '');
    throw err;
  }
  if (result.changes === 0) return null;
  const row = getProject(id)!;
  return { rev: row.rev, updatedAt: row.updatedAt };
}

export function deleteProject(id: string): boolean {
  return getDb().prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
}

/** Changes when another connection (e.g. the CLI) commits — SSE poller hook. */
export function dataVersion(): number {
  const row = getDb().prepare('PRAGMA data_version').get() as { data_version: number };
  return row.data_version;
}
