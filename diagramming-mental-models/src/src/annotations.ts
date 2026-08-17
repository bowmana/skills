import type { Annotation, Transform } from '../shared/types';

/**
 * Free-floating text boxes layered above the diagram. Boxes live in
 * diagram-space coordinates; the whole overlay is transformed with the same
 * pan/zoom as the SVG viewport. Mermaid's SVG is never touched — it gets
 * regenerated wholesale on every render.
 */
export class AnnotationLayer {
  items: Annotation[] = [];
  private els = new Map<string, HTMLElement>();
  private zoom = 1;
  onSave: (() => void) | null = null;

  constructor(private overlay: HTMLElement) {}

  setTransform(t: Transform): void {
    this.zoom = t.zoom;
    this.overlay.style.transform = `translate(${t.pan.x}px, ${t.pan.y}px) scale(${t.zoom})`;
  }

  load(items: Annotation[]): void {
    for (const el of this.els.values()) el.remove();
    this.els.clear();
    this.items = items;
    for (const item of items) this.mount(item);
  }

  add(x: number, y: number): void {
    const item: Annotation = {
      id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      x,
      y,
      text: 'Text',
    };
    this.items.push(item);
    this.mount(item, { startEditing: true });
    this.onSave?.();
  }

  private mount(item: Annotation, { startEditing = false } = {}): void {
    const el = document.createElement('div');
    el.className = 'note';
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;

    const content = document.createElement('div');
    content.className = 'note-text';
    content.textContent = item.text;

    const del = document.createElement('button');
    del.className = 'note-del';
    del.title = 'Delete';
    del.textContent = '×';
    del.addEventListener('pointerdown', (e) => e.stopPropagation());
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      this.remove(item.id);
    });

    el.append(content, del);
    this.overlay.appendChild(el);
    this.els.set(item.id, el);

    const beginEdit = () => {
      content.contentEditable = 'true';
      el.classList.add('editing');
      content.focus();
      const range = document.createRange();
      range.selectNodeContents(content);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
    };

    content.addEventListener('blur', () => {
      content.contentEditable = 'false';
      el.classList.remove('editing');
      item.text = content.innerText.trim();
      if (!item.text) {
        this.remove(item.id);
        return;
      }
      content.textContent = item.text;
      this.onSave?.();
    });

    content.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        content.blur();
      }
    });

    el.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (!el.classList.contains('editing')) beginEdit();
    });

    el.addEventListener('pointerdown', (e) => {
      if (el.classList.contains('editing')) return;
      e.stopPropagation(); // keep svg-pan-zoom from panning while dragging a note
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const startY = e.clientY;
      const origX = item.x;
      const origY = item.y;
      let moved = false;

      const onMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / this.zoom;
        const dy = (ev.clientY - startY) / this.zoom;
        if (Math.abs(dx) + Math.abs(dy) > 0.5) moved = true;
        item.x = origX + dx;
        item.y = origY + dy;
        el.style.left = `${item.x}px`;
        el.style.top = `${item.y}px`;
      };
      const onUp = () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        if (moved) this.onSave?.();
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
    });

    if (startEditing) beginEdit();
  }

  private remove(id: string): void {
    this.els.get(id)?.remove();
    this.els.delete(id);
    this.items = this.items.filter((i) => i.id !== id);
    this.onSave?.();
  }
}
