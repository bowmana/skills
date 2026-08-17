import type { ProjectSummary } from '../shared/types';

export interface SwitcherHandlers {
  getCurrentId: () => string | null;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onScratch: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function relTime(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** Calm project switcher: toolbar name button + plain popover list. */
export class Switcher {
  private summaries: ProjectSummary[] = [];
  private filter = '';
  /** project id whose delete button is in the "Delete?" confirm state */
  private confirmId: string | null = null;
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private button: HTMLElement,
    private popover: HTMLElement,
    private handlers: SwitcherHandlers,
  ) {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.popover.hidden) this.show();
      else this.hide();
    });
    document.addEventListener('click', (e) => {
      if (!this.popover.hidden && !this.popover.contains(e.target as Node)) this.hide();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.popover.hidden) this.hide();
    });
  }

  setLabel(name: string): void {
    this.button.textContent = name;
  }

  update(summaries: ProjectSummary[]): void {
    this.summaries = summaries;
    if (this.popover.hidden) return;
    // SSE broadcasts (incl. echoes of our own autosaves) arrive constantly —
    // never rebuild the list while the user is mid-rename
    if (this.popover.querySelector('.popover-rename')) return;
    this.renderList();
  }

  private show(): void {
    this.filter = '';
    this.popover.hidden = false;
    this.popover.innerHTML = `
      <input class="popover-filter" type="text" placeholder="Find or filter…" />
      <div class="popover-list"></div>
      <div class="popover-footer">
        <button class="popover-new tb-btn">＋ New project</button>
        <button class="popover-scratch tb-btn" title="Temp diagram — not saved unless you promote it">New scratch</button>
      </div>
    `;
    const input = this.popover.querySelector<HTMLInputElement>('.popover-filter')!;
    input.addEventListener('input', () => {
      this.filter = input.value.toLowerCase();
      this.renderList();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const first = this.visible()[0];
        if (first) {
          this.hide();
          this.handlers.onOpen(first.id);
        }
      }
    });
    this.popover.querySelector('.popover-new')!.addEventListener('click', () => {
      this.hide();
      this.handlers.onCreate();
    });
    this.popover.querySelector('.popover-scratch')!.addEventListener('click', () => {
      this.hide();
      this.handlers.onScratch();
    });
    this.renderList();
    input.focus();
  }

  hide(): void {
    this.popover.hidden = true;
    clearTimeout(this.confirmTimer);
    this.confirmId = null;
  }

  private visible(): ProjectSummary[] {
    return this.summaries.filter((s) => s.name.toLowerCase().includes(this.filter));
  }

  private renderList(): void {
    const list = this.popover.querySelector('.popover-list');
    if (!list) return;
    list.innerHTML = '';
    const currentId = this.handlers.getCurrentId();
    for (const s of this.visible()) {
      const row = document.createElement('div');
      row.className = 'popover-row' + (s.id === currentId ? ' current' : '');

      const name = document.createElement('span');
      name.className = 'popover-name';
      name.textContent = s.name;

      const time = document.createElement('span');
      time.className = 'popover-time';
      time.textContent = relTime(s.updatedAt);

      const ren = document.createElement('button');
      ren.className = 'popover-ren';
      ren.textContent = '✎';
      ren.title = 'Rename project';

      const del = document.createElement('button');
      del.className = 'popover-del';
      del.textContent = '×';
      del.title = 'Delete project';

      row.append(name, time, ren, del);
      list.appendChild(row);

      row.addEventListener('click', (e) => {
        if (e.target === del || e.target === ren) return;
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        this.hide();
        this.handlers.onOpen(s.id);
      });

      ren.addEventListener('click', (e) => {
        e.stopPropagation();
        const input = document.createElement('input');
        input.className = 'popover-rename';
        input.value = s.name;
        name.replaceWith(input);
        input.focus();
        input.select();
        // Enter commits and removes the input, which fires blur → guard
        // against the double-commit (replaceWith on a detached node throws)
        let done = false;
        const finish = (save: boolean) => {
          if (done) return;
          done = true;
          const value = input.value.trim();
          input.replaceWith(name);
          if (save && value && value !== s.name) this.handlers.onRename(s.id, value);
          this.renderList(); // catch up on updates deferred while renaming
        };
        input.addEventListener('keydown', (ev) => {
          ev.stopPropagation();
          if (ev.key === 'Enter') finish(true);
          if (ev.key === 'Escape') finish(false);
        });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('click', (ev) => ev.stopPropagation());
      });

      if (this.confirmId === s.id) {
        del.dataset.confirm = '1';
        del.textContent = 'Delete?';
      }
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.confirmId === s.id) {
          clearTimeout(this.confirmTimer);
          this.confirmId = null;
          this.handlers.onDelete(s.id);
        } else {
          this.confirmId = s.id;
          del.dataset.confirm = '1';
          del.textContent = 'Delete?';
          clearTimeout(this.confirmTimer);
          this.confirmTimer = setTimeout(() => {
            this.confirmId = null;
            if (!this.popover.hidden) this.renderList();
          }, 3000);
        }
      });
    }
    if (this.visible().length === 0) {
      const empty = document.createElement('div');
      empty.className = 'popover-empty';
      empty.textContent = this.summaries.length ? 'No match' : 'No projects yet';
      list.appendChild(empty);
    }
  }
}
