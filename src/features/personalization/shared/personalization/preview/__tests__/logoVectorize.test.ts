import { describe, it, expect, vi } from 'vitest';
import { LogoTraceError, MAX_SVG_BYTES, isSafeSvg, svgToDataUrl, traceLogo, traceSize } from '../logoVectorize';

const px = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) as unknown as ImageData;
const reader = (w: number, h: number) => vi.fn(async (_b: Blob, size: (a: number, b: number) => { width: number; height: number }) => { const s = size(w, h); return px(s.width, s.height); });
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><path d="M0 0h4v4z" fill="rgb(1,2,3)"/></svg>';

describe('traceSize', () => {
  it('scales the longest side down to the limit and never enlarges', () => {
    expect(traceSize(800, 400, 400)).toEqual({ width: 400, height: 200 });
    expect(traceSize(100, 50, 400)).toEqual({ width: 100, height: 50 });
    expect(traceSize(0, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe('isSafeSvg', () => {
  it('accepts a plain svg (with an xml prolog or comment)', () => {
    expect(isSafeSvg(SVG)).toBe(true);
    expect(isSafeSvg(`<?xml version="1.0"?>\n<!-- t -->\n${SVG}`)).toBe(true);
  });
  it('rejects anything executable or not an svg', () => {
    for (const bad of [
      '<svg><script>alert(1)</script></svg>', '<svg onload="x()"></svg>', '<svg><foreignObject/></svg>', '<svg><a href="javascript:x()"/></svg>',
      '<html></html>', '', '<svg><iframe src="x"/></svg>',
    ]) expect(isSafeSvg(bad), bad).toBe(false);
  });
});

describe('svgToDataUrl', () => {
  it('base64-encodes, including non-ASCII text', () => {
    const url = svgToDataUrl('<svg>é</svg>');
    expect(url.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(new TextDecoder().decode(Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0)))).toBe('<svg>é</svg>');
  });
});

describe('traceLogo', () => {
  it('traces at the limited size with the requested colour count and returns a data URL', async () => {
    const tracer = { imagedataToSVG: vi.fn(() => SVG) };
    const out = await traceLogo(new Blob(['x']), { tracer, readPixels: reader(800, 400), maxSide: 200, colors: 6 });
    expect(tracer.imagedataToSVG).toHaveBeenCalledWith(expect.objectContaining({ width: 200, height: 100 }), expect.objectContaining({ numberofcolors: 6 }));
    expect(out).toMatchObject({ svg: SVG, width: 200, height: 100 });
    expect(out.dataUrl.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });
  it('clamps the colour count to 2..16', async () => {
    const tracer = { imagedataToSVG: vi.fn(() => SVG) };
    await traceLogo(new Blob(['x']), { tracer, readPixels: reader(10, 10), colors: 99 });
    await traceLogo(new Blob(['x']), { tracer, readPixels: reader(10, 10), colors: 0 });
    expect(tracer.imagedataToSVG.mock.calls.map((c) => (c[1] as any).numberofcolors)).toEqual([16, 2]);
  });
  it('refuses an unsafe result, a huge result, and a tracer that throws', async () => {
    const run = (svg: string | Error) => traceLogo(new Blob(['x']), { tracer: { imagedataToSVG: () => { if (svg instanceof Error) throw svg; return svg; } }, readPixels: reader(10, 10) });
    await expect(run('<svg><script/></svg>')).rejects.toMatchObject({ reason: 'unsafe' });
    await expect(run(`<svg>${'a'.repeat(MAX_SVG_BYTES)}</svg>`)).rejects.toMatchObject({ reason: 'too-complex' });
    await expect(run(new Error('boom'))).rejects.toMatchObject({ reason: 'failed' });
  });
  it('reports an unreadable image as a trace error', async () => {
    const readPixels = vi.fn(async () => { throw new Error('bad image'); });
    await expect(traceLogo(new Blob(['x']), { tracer: { imagedataToSVG: () => SVG }, readPixels })).rejects.toBeInstanceOf(LogoTraceError);
  });
  it('traces a real image with the bundled library (no mock)', async () => {
    const data = new Uint8ClampedArray(16 * 16 * 4);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = (y * 16 + x) * 4; const inside = x > 3 && x < 12 && y > 3 && y < 12; data[i] = inside ? 255 : 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 255; }
    const out = await traceLogo(new Blob(['x']), { readPixels: async () => ({ width: 16, height: 16, data }) as unknown as ImageData });
    expect(out.svg).toMatch(/<svg/);
    expect(isSafeSvg(out.svg)).toBe(true);
  });
});
