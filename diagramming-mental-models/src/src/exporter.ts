function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

/**
 * Mermaid's SVG string contains HTML-style tags (`<br>`) inside foreignObject
 * labels, which is invalid XML — browsers refuse to decode it as an image and
 * standalone viewers reject it. Round-trip through the tolerant HTML parser
 * and re-serialize as well-formed XML (mermaid.live does regex fixups instead).
 */
function normalizeSvg(svgText: string): { xml: string; width: number; height: number; svg: SVGSVGElement } {
  const host = document.createElement('div');
  host.innerHTML = svgText;
  const svg = host.querySelector('svg');
  if (!svg) throw new Error('no SVG in render output');
  let width = 1200;
  let height = 800;
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const [, , w, h] = viewBox.split(/[\s,]+/).map(Number);
    if (w > 0 && h > 0) {
      width = w;
      height = h;
    }
  }
  return { xml: new XMLSerializer().serializeToString(svg), width, height, svg };
}

export function downloadSvg(svgText: string, filename = 'diagram.svg'): void {
  const { xml } = normalizeSvg(svgText);
  const blob = new Blob(
    ['<?xml version="1.0" encoding="UTF-8"?>\n', xml],
    { type: 'image/svg+xml;charset=utf-8' },
  );
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Rasterize the (fitted, viewBox-sized) diagram onto a canvas. */
async function rasterize(svgText: string, scale: number): Promise<HTMLCanvasElement> {
  const { width, height, svg } = normalizeSvg(svgText);

  // Explicit pixel size so the browser rasterizes at the right intrinsic size
  // (mermaid emits width="100%" when useMaxWidth is on).
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  const sized = new XMLSerializer().serializeToString(svg);

  // data URI, not a blob URL: Chromium taints the canvas for blob-URL SVGs
  // containing <foreignObject>; data URIs rasterize clean (mermaid.live does
  // the same). btoa needs latin1, hence the TextEncoder round-trip.
  const bytes = new TextEncoder().encode(sized);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const url = `data:image/svg+xml;base64,${btoa(binary)}`;
  {
    const img = new Image();
    img.src = url;
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return canvas;
  }
}

/** Used by both the PNG download button and `ml render` (headless hook). */
export async function pngDataUrl(svgText: string, scale = 2): Promise<string> {
  return (await rasterize(svgText, scale)).toDataURL('image/png');
}

export async function downloadPng(
  svgText: string,
  filename = 'diagram.png',
  scale = 2,
): Promise<void> {
  triggerDownload(await pngDataUrl(svgText, scale), filename);
}

export async function copyPngToClipboard(svgText: string, scale = 2): Promise<void> {
  const canvas = await rasterize(svgText, scale);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG encoding failed');
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
