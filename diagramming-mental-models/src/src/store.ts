// Browser-local UI preferences only — all document content lives in SQLite
// via the API. See docs/memory.md (2026-07-29, projects feature).
import type { Annotation, Transform } from '../shared/types';

export interface UiPrefs {
  autoRender: boolean;
  editorVisible: boolean;
  editorWidth: number | null;
  lastProjectId: string | null;
}

const KEY = 'mermaid-lite:ui:v1';
const LEGACY_KEY = 'mermaid-lite:v1';

export function loadPrefs(): UiPrefs {
  const defaults: UiPrefs = {
    autoRender: true,
    editorVisible: true,
    editorWidth: null,
    lastProjectId: null,
  };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<UiPrefs>) } : defaults;
  } catch {
    return defaults;
  }
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export const savePrefs = debounce((prefs: UiPrefs) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // non-fatal
  }
}, 300);

export interface LegacyState {
  code: string;
  theme: string;
  annotations: Annotation[];
  panZoom: Transform | null;
}

/**
 * One-time migration source: the pre-projects localStorage document. Renames
 * the key (kept as backup) so migration runs only once.
 */
export function takeLegacyState(): LegacyState | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    localStorage.setItem(`${LEGACY_KEY}:migrated`, raw);
    localStorage.removeItem(LEGACY_KEY);
    const s = JSON.parse(raw) as Partial<LegacyState>;
    return {
      code: s.code ?? '',
      theme: s.theme ?? 'default',
      annotations: s.annotations ?? [],
      panZoom: s.panZoom ?? null,
    };
  } catch {
    return null;
  }
}
