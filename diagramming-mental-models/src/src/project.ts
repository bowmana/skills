import type { Project, ProjectSummary, ProjectPatch } from '../shared/types';
import * as api from './api';

/**
 * Current-project controller: owns the loaded project, batches saves into a
 * debounced PATCH, and reconciles external (CLI) edits arriving over SSE.
 * Conflicts are last-writer-wins with a short typing-grace window — fine for
 * a single local user (docs/memory.md).
 */
export class ProjectController {
  current: Project | null = null;
  private lastRev = 0;
  private pending: ProjectPatch = {};
  private inflight = false;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private lastLocalEdit = 0;

  onExternal: ((project: Project) => void) | null = null;
  onDeleted: (() => void) | null = null;

  async open(id: string): Promise<Project> {
    await this.flush();
    this.pending = {};
    const project = await api.getProject(id);
    this.current = project;
    this.lastRev = project.rev;
    return project;
  }

  detach(): void {
    this.current = null;
    this.pending = {};
  }

  queue(patch: ProjectPatch): void {
    if (!this.current) return;
    if (patch.code !== undefined) this.lastLocalEdit = Date.now();
    Object.assign(this.pending, patch);
    Object.assign(this.current, patch);
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => void this.flush(), 500);
  }

  async flush(): Promise<void> {
    clearTimeout(this.flushTimer);
    if (!this.current || Object.keys(this.pending).length === 0) return;
    const patch = this.pending;
    this.pending = {};
    this.inflight = true;
    try {
      const expected = this.lastRev + 1;
      const { rev } = await api.patchProject(this.current.id, patch);
      this.lastRev = Math.max(this.lastRev, rev);
      // rev jumped past expected → someone else (CLI) wrote between our
      // saves; our partial PATCH didn't clobber their fields, but our local
      // copy is stale — reconcile. Guards against the race where our own
      // pan/zoom save outruns an external code edit's rev.
      if (rev !== expected) this.scheduleReconcile();
    } catch {
      // put the patch back so the next queue/flush retries it
      this.pending = { ...patch, ...this.pending };
    } finally {
      this.inflight = false;
    }
  }

  private reconcileTimer: ReturnType<typeof setTimeout> | undefined;

  private scheduleReconcile(): void {
    clearTimeout(this.reconcileTimer);
    this.reconcileTimer = setTimeout(() => void this.reconcile(), 300);
  }

  private async reconcile(): Promise<void> {
    if (!this.current) return;
    if (this.inflight || Object.keys(this.pending).length > 0) {
      this.scheduleReconcile();
      return;
    }
    const fresh = await api.getProject(this.current.id).catch(() => null);
    if (!fresh || !this.current || fresh.id !== this.current.id) return;
    this.lastRev = Math.max(this.lastRev, fresh.rev);
    const differs =
      fresh.code !== this.current.code ||
      fresh.name !== this.current.name ||
      fresh.theme !== this.current.theme ||
      JSON.stringify(fresh.annotations) !== JSON.stringify(this.current.annotations);
    if (!differs) return;
    if (Date.now() - this.lastLocalEdit < 2000) {
      // user is mid-typing: documented last-writer-wins — their next save
      // overwrites; don't yank the editor out from under them
      return;
    }
    this.current = fresh;
    this.onExternal?.(fresh);
  }

  handleChange(summaries: ProjectSummary[]): void {
    if (!this.current) return;
    const mine = summaries.find((s) => s.id === this.current!.id);
    if (!mine) {
      this.onDeleted?.();
      return;
    }
    if (mine.rev <= this.lastRev) return;
    const busy =
      this.inflight ||
      Object.keys(this.pending).length > 0 ||
      Date.now() - this.lastLocalEdit < 2000;
    if (busy) {
      // a local save is settling — re-check shortly; our own PATCH response
      // will have advanced lastRev past this rev if the change was ours
      setTimeout(() => this.handleChange(summaries), 1500);
      return;
    }
    void api.getProject(this.current.id).then((fresh) => {
      if (!this.current || this.current.id !== fresh.id) return;
      if (fresh.rev <= this.lastRev) return;
      this.current = fresh;
      this.lastRev = fresh.rev;
      this.onExternal?.(fresh);
    });
  }
}
