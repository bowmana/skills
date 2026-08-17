import { renderForExport } from './render';
import { pngDataUrl } from './exporter';

/**
 * Hook for `ml render` (puppeteer): exposes the app's OWN export pipeline so
 * headless output is identical to the in-app export buttons. Also handy from
 * devtools.
 */
export function installHeadlessHook(): void {
  (window as unknown as { __mermaidLite: object }).__mermaidLite = {
    renderSvg: (code: string, theme?: string) => renderForExport(code, theme ?? 'default'),
    renderPng: async (code: string, theme?: string, scale = 2) =>
      pngDataUrl(await renderForExport(code, theme ?? 'default'), scale),
  };
}
