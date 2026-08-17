import mermaid from 'mermaid';
import elkLayouts from '@mermaid-js/layout-elk';
import tidyTreeLayouts from '@mermaid-js/layout-tidy-tree';
import zenuml from '@mermaid-js/mermaid-zenuml';

// Mirrors mermaid.live: elk + tidy-tree layouts and zenuml are registered up front.
mermaid.registerLayoutLoaders([...elkLayouts, ...tidyTreeLayouts]);
const externalsReady = mermaid.registerExternalDiagrams([zenuml], { lazyLoad: true });

const RENDER_ID = 'ml-view';

/**
 * Upstream mermaid bug: a bare `%%` comment line (no text after it) survives
 * mermaid's comment cleanup and corrupts the parse of whatever follows.
 * Blank them out — a bare `%%` is an empty comment, so this is behavior-neutral.
 * See docs/lessons.md (2026-07-29).
 */
function sanitize(code: string): string {
  return code.replace(/^\s*%%\s*$/gm, '');
}

export interface RenderOutcome {
  ok: boolean;
  error?: unknown;
  diagramType?: string;
}

function initialize(theme: string): void {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: theme as 'default',
    suppressErrorRendering: true,
    // Secure keys can only be raised here, not from diagram text. Local files
    // are trusted, so lift the defaults (50k chars / 500 edges).
    maxTextSize: 200_000,
    maxEdges: 4_000,
  });
}

/** Validate only — used by the editor lint pass. Throws mermaid's parse error. */
export async function validate(code: string, theme: string): Promise<void> {
  await externalsReady;
  initialize(theme);
  await mermaid.parse(sanitize(code));
}

// Renders are serialized: mermaid.render uses shared DOM scratch space and the
// live editor chains renders the same way to avoid races.
let chain: Promise<unknown> = Promise.resolve();
let seq = 0;

export function render(
  code: string,
  theme: string,
  container: HTMLElement,
): Promise<RenderOutcome> {
  const mySeq = ++seq;
  const run = chain.then(async (): Promise<RenderOutcome> => {
    if (mySeq !== seq) return { ok: true }; // superseded, keep last outcome
    await externalsReady;
    await document.fonts.ready;
    initialize(theme);
    const clean = sanitize(code);
    try {
      await mermaid.parse(clean);
      const { svg, bindFunctions, diagramType } = await mermaid.render(RENDER_ID, clean);
      if (mySeq !== seq) return { ok: true };
      container.innerHTML = svg;
      const svgEl = container.querySelector('svg');
      if (svgEl) {
        // Fill the canvas; svg-pan-zoom takes over the transform from here.
        svgEl.style.maxWidth = 'none';
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
      }
      bindFunctions?.(container);
      return { ok: true, diagramType };
    } catch (error) {
      document.querySelector(`#d${RENDER_ID}`)?.remove();
      return { ok: false, error };
    }
  });
  chain = run.catch(() => {});
  return run;
}

/**
 * Fresh off-screen render for export — the live SVG is polluted by
 * svg-pan-zoom's viewport wrapper/transform, so never serialize it.
 */
export async function renderForExport(code: string, theme: string): Promise<string> {
  await externalsReady;
  initialize(theme);
  const { svg } = await mermaid.render('ml-export', sanitize(code));
  document.querySelector('#dml-export')?.remove();
  return svg;
}

/**
 * Best-guess 1-based error line. Mermaid's reported line is often wrong
 * (mermaid.live fuzzy-matches to correct it); hash.loc + clamp is good enough
 * to start — see docs/lessons.md.
 */
export function errorLine(error: unknown, code: string): number | null {
  const err = error as { message?: string; hash?: { loc?: { first_line?: number } } };
  let line: number | null = err?.hash?.loc?.first_line ?? null;
  if (line === null) {
    const m = /error on line (\d+)/i.exec(String(err?.message ?? error));
    line = m ? Number(m[1]) : null;
  }
  if (line === null) return null;
  return Math.min(Math.max(1, line), code.split('\n').length);
}

export function errorMessage(error: unknown): string {
  const msg = String((error as { message?: string })?.message ?? error);
  return msg.trim() || 'Unknown render error';
}
