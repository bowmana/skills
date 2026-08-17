import './style.css';
import { createEditor, type EditorHandles } from './editor';
import { render, renderForExport, errorMessage } from './render';
import { PanZoomState } from './panzoom';
import { AnnotationLayer } from './annotations';
import { loadPrefs, savePrefs, debounce, takeLegacyState, type UiPrefs } from './store';
import { SAMPLES, DEFAULT_SAMPLE } from './samples';
import { downloadSvg, downloadPng, copyPngToClipboard } from './exporter';
import { installHeadlessHook } from './headless';
import { ProjectController } from './project';
import { Switcher } from './switcher';
import * as api from './api';
import type { Annotation, Transform } from '../shared/types';

// Headless mode (`ml render` via puppeteer): expose the render hook, skip the UI.
const params = new URLSearchParams(location.search);
if (params.get('headless') === '1') {
  installHeadlessHook();
} else {
  void boot();
}

/** 'project' autosaves to SQLite; 'scratch' and 'file' live only in memory. */
type Mode = 'project' | 'scratch' | 'file';

function decodeScratch(hash: string): string | null {
  const m = /^#scratch=(.+)$/.exec(hash);
  if (!m) return null;
  try {
    const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

function encodeScratch(code: string): string {
  const bytes = new TextEncoder().encode(code);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function boot(): Promise<void> {
  const $ = <T extends HTMLElement>(sel: string): T => {
    const el = document.querySelector<T>(sel);
    if (!el) throw new Error(`missing element ${sel}`);
    return el;
  };

  const canvasEl = $('#canvas');
  const diagramEl = $('#diagram');
  const overlayEl = $('#overlay');
  const editorPane = $('#editor-pane');
  const errorBar = $('#error-bar');
  const errorText = $('#error-text');
  const themeSelect = $<HTMLSelectElement>('#theme-select');
  const sampleSelect = $<HTMLSelectElement>('#sample-select');
  const autoRenderBox = $<HTMLInputElement>('#auto-render');
  const saveScratchBtn = $<HTMLButtonElement>('#save-scratch');

  const prefs: UiPrefs = loadPrefs();
  const controller = new ProjectController();
  let mode: Mode = 'project';
  let theme = 'default';
  let suppressEditorEvents = false;
  let editor: EditorHandles;

  const showError = (msg: string) => {
    errorText.textContent = msg;
    errorBar.hidden = false;
  };

  // --- canvas: pan/zoom + annotation overlay -------------------------------

  const panZoom = new PanZoomState(canvasEl);
  const annotations = new AnnotationLayer(overlayEl);

  panZoom.onChange = (t) => {
    annotations.setTransform(t);
    if (mode === 'project') controller.queue({ panZoom: t });
  };
  annotations.onSave = () => {
    if (mode === 'project') controller.queue({ annotations: annotations.items });
  };

  // --- render loop ----------------------------------------------------------

  async function renderNow({ resetView = false } = {}): Promise<void> {
    const code = editor.getCode();
    if (!code.trim()) {
      panZoom.detachInstance(); // before removing its SVG
      diagramEl.innerHTML = '';
      errorBar.hidden = true;
      return;
    }
    const outcome = await render(code, theme, diagramEl);
    if (outcome.ok) {
      const svgEl = diagramEl.querySelector('svg');
      if (svgEl) panZoom.attach(svgEl, { reset: resetView });
      diagramEl.classList.remove('stale');
      errorBar.hidden = true;
    } else {
      diagramEl.classList.add('stale');
      showError(errorMessage(outcome.error));
    }
  }

  const debouncedRender = debounce(() => void renderNow(), 300);

  // --- editor ---------------------------------------------------------------

  // keep the scratch URL in sync with the code so a reload doesn't lose it
  const syncScratchHash = debounce((code: string) => {
    if (mode === 'scratch' && code.trim()) {
      history.replaceState(null, '', `/#scratch=${encodeScratch(code)}`);
    }
  }, 500);

  editor = createEditor(editorPane, '', {
    getTheme: () => theme,
    onRenderNow: () => void renderNow(),
    onChange: (code) => {
      if (suppressEditorEvents) return;
      if (mode === 'project') controller.queue({ code });
      if (mode === 'scratch') syncScratchHash(code);
      if (prefs.autoRender) debouncedRender();
    },
  });

  function setDocument(doc: {
    code: string;
    theme: string;
    annotations: Annotation[];
    panZoom: Transform | null;
    resetView?: boolean;
  }): void {
    suppressEditorEvents = true;
    editor.setCode(doc.code);
    suppressEditorEvents = false;
    theme = doc.theme;
    themeSelect.value = doc.theme;
    annotations.load(doc.annotations);
    const resetView = doc.resetView ?? !doc.panZoom;
    // drop the previous document's transform or it leaks into this one's
    // first real render (e.g. new empty project → first typed diagram)
    if (resetView) panZoom.clear();
    if (doc.panZoom) panZoom.restore(doc.panZoom);
    void renderNow({ resetView });
  }

  // --- project switcher -----------------------------------------------------

  function enterScratch(code = ''): void {
    void controller.flush();
    controller.detach();
    mode = 'scratch';
    switcher.setLabel('Scratch');
    saveScratchBtn.hidden = false;
    history.replaceState(null, '', code.trim() ? `/#scratch=${encodeScratch(code)}` : '/#scratch');
    setDocument({ code, theme: 'default', annotations: [], panZoom: null, resetView: true });
  }

  const switcher = new Switcher($('#project-btn'), $('#project-popover'), {
    getCurrentId: () => controller.current?.id ?? null,
    onOpen: (id) => void openProject(id),
    onCreate: () =>
      void api
        .createProject({})
        .then((p) => openProject(p.id))
        .catch((err) => showError(errorMessage(err))),
    onScratch: () => enterScratch(),
    onRename: (id, name) =>
      void api
        .patchProject(id, { name })
        .then(() => refreshSummaries())
        .catch((err) => showError(errorMessage(err))),
    onDelete: (id) =>
      void api.deleteProject(id).then(async () => {
        await refreshSummaries();
        if (controller.current?.id === id) {
          const rest = await api.listProjects();
          if (rest.length) await openProject(rest[0].id);
          else await openProject((await api.createProject({ code: DEFAULT_SAMPLE })).id);
        }
      }),
  });

  async function refreshSummaries(): Promise<void> {
    const summaries = await api.listProjects();
    switcher.update(summaries);
    const mine = summaries.find((s) => s.id === controller.current?.id);
    if (mine && controller.current) {
      controller.current.name = mine.name;
      switcher.setLabel(mine.name);
    }
  }

  let subscribed = false;
  function ensureSubscribed(): void {
    if (subscribed) return;
    subscribed = true;
    api.subscribe((updated) => {
      switcher.update(updated);
      const mine = updated.find((s) => s.id === controller.current?.id);
      if (mine && controller.current && mine.name !== controller.current.name) {
        controller.current.name = mine.name;
        switcher.setLabel(mine.name);
      }
      controller.handleChange(updated);
    });
  }

  async function openProject(id: string): Promise<void> {
    const project = await controller.open(id);
    mode = 'project'; // scratch/file sessions become saving sessions here
    saveScratchBtn.hidden = true;
    // drop ?project=/#scratch= so a reload follows lastProjectId, not the URL
    if (location.search || location.hash) history.replaceState(null, '', '/');
    prefs.lastProjectId = id;
    savePrefs(prefs);
    switcher.setLabel(project.name);
    setDocument(project);
    ensureSubscribed();
  }

  controller.onExternal = (project) => {
    switcher.setLabel(project.name);
    setDocument({ ...project, panZoom: panZoom.current(), resetView: false });
  };
  controller.onDeleted = () => {
    showError('This project was deleted outside the app.');
  };

  // --- boot mode ------------------------------------------------------------

  const scratchCode = decodeScratch(location.hash);
  const srcParam = params.get('src');

  if (scratchCode !== null) {
    mode = 'scratch';
    switcher.setLabel('Scratch');
    saveScratchBtn.hidden = false;
    setDocument({ code: scratchCode, theme: 'default', annotations: [], panZoom: null });
    void api.listProjects().then((s) => switcher.update(s)).catch(() => {});
  } else if (srcParam) {
    mode = 'file';
    switcher.setLabel(srcParam.split('/').pop() ?? srcParam);
    saveScratchBtn.hidden = false;
    try {
      const res = await fetch(srcParam);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setDocument({ code: await res.text(), theme: 'default', annotations: [], panZoom: null });
    } catch (err) {
      showError(`Could not load ${srcParam}: ${errorMessage(err)}`);
    }
    void api.listProjects().then((s) => switcher.update(s)).catch(() => {});
  } else {
    try {
      let summaries = await api.listProjects();
      if (summaries.length === 0) {
        const legacy = takeLegacyState();
        await api.createProject(
          legacy
            ? { name: 'Migrated diagram', code: legacy.code, theme: legacy.theme }
            : { code: DEFAULT_SAMPLE },
        );
        summaries = await api.listProjects();
      }
      switcher.update(summaries);
      const target = summaries.find((s) => s.id === params.get('project'))
        ?? summaries.find((s) => s.id === prefs.lastProjectId)
        ?? summaries[0];
      await openProject(target.id);
    } catch (err) {
      // API unreachable (vite without the server) — degrade to scratch mode
      mode = 'scratch';
      switcher.setLabel('Scratch (server offline)');
      setDocument({ code: DEFAULT_SAMPLE, theme: 'default', annotations: [], panZoom: null });
      showError(
        `API not reachable (${errorMessage(err)}). Running unsaved — start the server with \`npm run dev\` or \`ml serve\`.`,
      );
    }
  }

  // Scratch/file → project promotion.
  saveScratchBtn.addEventListener('click', () =>
    void api
      .createProject({ code: editor.getCode(), theme })
      .then(async (project) => {
        await api.patchProject(project.id, {
          annotations: annotations.items,
          panZoom: panZoom.current(),
        });
        await refreshSummaries();
        await openProject(project.id); // flips to project mode, subscribes
      })
      .catch((err) => showError(`Could not save: ${errorMessage(err)}`)),
  );

  // --- toolbar --------------------------------------------------------------

  autoRenderBox.checked = prefs.autoRender;
  autoRenderBox.addEventListener('change', () => {
    prefs.autoRender = autoRenderBox.checked;
    savePrefs(prefs);
    if (prefs.autoRender) void renderNow();
  });

  $('#render-now').addEventListener('click', () => void renderNow());

  themeSelect.addEventListener('change', () => {
    theme = themeSelect.value;
    if (mode === 'project') controller.queue({ theme });
    void renderNow();
  });

  for (const name of Object.keys(SAMPLES)) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sampleSelect.appendChild(opt);
  }
  sampleSelect.addEventListener('change', () => {
    const name = sampleSelect.value;
    if (!name) return;
    sampleSelect.value = '';
    suppressEditorEvents = true;
    editor.setCode(SAMPLES[name]);
    suppressEditorEvents = false;
    if (mode === 'project') controller.queue({ code: SAMPLES[name] });
    void renderNow({ resetView: true });
  });

  $('#zoom-in').addEventListener('click', () => panZoom.zoomIn());
  $('#zoom-out').addEventListener('click', () => panZoom.zoomOut());
  $('#zoom-fit').addEventListener('click', () => panZoom.fit());

  function setEditorVisible(visible: boolean): void {
    prefs.editorVisible = visible;
    editorPane.hidden = !visible;
    $('#divider').hidden = !visible;
    savePrefs(prefs);
  }
  $('#toggle-editor').addEventListener('click', () => setEditorVisible(!prefs.editorVisible));
  setEditorVisible(prefs.editorVisible);
  if (prefs.editorWidth) editorPane.style.width = `${prefs.editorWidth}px`;

  // --- annotations placement ------------------------------------------------

  let placing = false;
  $('#add-note').addEventListener('click', () => {
    placing = !placing;
    canvasEl.classList.toggle('placing', placing);
  });
  canvasEl.addEventListener('click', (e) => {
    if (!placing) return;
    placing = false;
    canvasEl.classList.remove('placing');
    const rect = canvasEl.getBoundingClientRect();
    const p = panZoom.toDiagram(e.clientX - rect.left, e.clientY - rect.top);
    annotations.add(p.x, p.y);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && placing) {
      placing = false;
      canvasEl.classList.remove('placing');
    }
  });

  // --- export ---------------------------------------------------------------

  async function exportAs(kind: 'svg' | 'png'): Promise<void> {
    try {
      const name = controller.current?.name ?? 'diagram';
      const svg = await renderForExport(editor.getCode(), theme);
      if (kind === 'svg') downloadSvg(svg, `${name}.svg`);
      else await downloadPng(svg, `${name}.png`);
    } catch (err) {
      showError(`Export failed: ${errorMessage(err)}`);
    }
  }
  $('#export-svg').addEventListener('click', () => void exportAs('svg'));
  $('#export-png').addEventListener('click', () => void exportAs('png'));

  const copyBtn = $<HTMLButtonElement>('#copy-png');
  copyBtn.addEventListener('click', async () => {
    try {
      const svg = await renderForExport(editor.getCode(), theme);
      await copyPngToClipboard(svg);
      copyBtn.textContent = 'Copied ✓';
    } catch (err) {
      copyBtn.textContent = 'Copy failed';
      showError(`Copy failed: ${errorMessage(err)}`);
    }
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
    }, 1400);
  });

  // --- global shortcuts -----------------------------------------------------

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      setEditorVisible(!prefs.editorVisible);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      void controller.flush();
    }
  });
  window.addEventListener('beforeunload', () => void controller.flush());

  // --- editor/canvas split drag --------------------------------------------

  const divider = $('#divider');
  divider.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    divider.setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const w = Math.min(Math.max(ev.clientX, 220), window.innerWidth - 320);
      editorPane.style.width = `${w}px`;
      prefs.editorWidth = w;
    };
    const onUp = () => {
      divider.removeEventListener('pointermove', onMove);
      divider.removeEventListener('pointerup', onUp);
      savePrefs(prefs);
    };
    divider.addEventListener('pointermove', onMove);
    divider.addEventListener('pointerup', onUp);
  });
}
