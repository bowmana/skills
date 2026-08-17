import svgPanZoom from 'svg-pan-zoom';
import type { Transform } from '../shared/types';

export type { Transform };

/**
 * Owns the svg-pan-zoom lifecycle. The instance cannot survive
 * container.innerHTML replacement, so it is destroyed and re-created on every
 * render; the current transform is captured continuously and restored on
 * re-attach (zoom before pan — pan coords are zoom-dependent).
 */
export class PanZoomState {
  private instance: SvgPanZoom.Instance | null = null;
  private saved: Transform | null = null;
  /** true once the user has panned/zoomed manually (blocks auto-fit on resize) */
  private dirty = false;
  onChange: ((t: Transform) => void) | null = null;

  constructor(container: HTMLElement) {
    const ro = new ResizeObserver(() => {
      if (!this.instance) return;
      this.instance.resize();
      if (!this.dirty) {
        this.instance.fit();
        this.instance.center();
      }
    });
    ro.observe(container);
  }

  /** Seed a transform (from a saved project) before the next attach. */
  restore(t: Transform): void {
    this.saved = t;
    this.dirty = true;
  }

  /** Forget the saved transform (e.g. when switching to another document). */
  clear(): void {
    this.saved = null;
    this.dirty = false;
  }

  /**
   * Destroy the instance when its SVG is removed without a replacement
   * (empty document) — a live instance on a detached SVG throws
   * "SVGMatrix not invertible" from its event handlers.
   */
  detachInstance(): void {
    this.instance?.destroy();
    this.instance = null;
  }

  /**
   * Would applying {pan, zoom} leave a meaningful part of the diagram on
   * screen? Computed from viewBox math, NOT the live DOM — svg-pan-zoom
   * defers CTM updates to the next animation frame, so the DOM can't be
   * inspected right after a restore.
   */
  private saneTransform(
    t: Transform,
    sizes: {
      width: number;
      height: number;
      viewBox: { x: number; y: number; width: number; height: number };
    },
  ): boolean {
    const bx = t.pan.x + sizes.viewBox.x * t.zoom;
    const by = t.pan.y + sizes.viewBox.y * t.zoom;
    const bw = sizes.viewBox.width * t.zoom;
    const bh = sizes.viewBox.height * t.zoom;
    if (!Number.isFinite(bw) || bw <= 4) return false;
    const ix = Math.min(bx + bw, sizes.width) - Math.max(bx, 0);
    const iy = Math.min(by + bh, sizes.height) - Math.max(by, 0);
    return ix > 40 && iy > 40 && bw < sizes.width * 100;
  }

  attach(svg: SVGSVGElement, { reset = false } = {}): void {
    this.instance?.destroy();
    this.instance = svgPanZoom(svg, {
      fit: true,
      center: true,
      controlIconsEnabled: false,
      dblClickZoomEnabled: false, // double-click is annotation-edit
      zoomScaleSensitivity: 0.25,
      minZoom: 0.02,
      maxZoom: 50,
      onPan: () => {
        this.dirty = true;
      },
      onZoom: () => {
        this.dirty = true;
      },
      onUpdatedCTM: (m) => {
        this.saved = { pan: { x: m.e, y: m.f }, zoom: m.a };
        this.onChange?.(this.saved);
      },
    });

    if (reset) {
      this.dirty = false;
      this.instance.zoom(0.9); // slight margin so nothing hides under the toolbar
      this.instance.center();
      return;
    }

    const t = this.saved;
    // saved zoom is the ABSOLUTE CTM scale (from onUpdatedCTM), but
    // instance.zoom() expects a value relative to the initial fit scale —
    // divide by it or restores land off-screen at wild zoom levels
    const sizes = this.instance.getSizes() as {
      realZoom: number;
      width: number;
      height: number;
      viewBox: { x: number; y: number; width: number; height: number };
    };
    const baseScale = sizes.realZoom / this.instance.getZoom();
    if (
      t &&
      Number.isFinite(t.zoom) &&
      t.zoom > 0 &&
      Number.isFinite(t.pan.x) &&
      Number.isFinite(t.pan.y) &&
      Number.isFinite(baseScale) &&
      baseScale > 0 &&
      this.saneTransform(t, sizes) // off-screen saves (old buggy builds) → fit
    ) {
      this.instance.zoom(t.zoom / baseScale);
      this.instance.pan(t.pan);
    } else {
      this.dirty = false;
      this.instance.zoom(0.9);
      this.instance.center();
    }
  }

  zoomIn(): void {
    this.instance?.zoomIn();
  }

  zoomOut(): void {
    this.instance?.zoomOut();
  }

  fit(): void {
    if (!this.instance) return;
    this.instance.resize();
    this.instance.fit();
    this.instance.center();
    this.instance.zoom(this.instance.getZoom() * 0.9);
    this.dirty = false;
  }

  current(): Transform | null {
    return this.saved;
  }

  /** Convert a point in canvas CSS pixels to diagram-space coordinates. */
  toDiagram(canvasX: number, canvasY: number): { x: number; y: number } {
    const t = this.saved ?? { pan: { x: 0, y: 0 }, zoom: 1 };
    return { x: (canvasX - t.pan.x) / t.zoom, y: (canvasY - t.pan.y) / t.zoom };
  }
}
