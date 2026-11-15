// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { composeStill, contentShare, TILE } from '../../scripts/template-thumbs/compose.mjs';

const sharp = createRequire(import.meta.url)('sharp');
const W = 960; const H = 540;
/** A transparent frame with one coloured rectangle on it. */
const frame = (rect, color) => sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: { create: { width: rect.w, height: rect.h, channels: 4, background: color } }, left: rect.x, top: rect.y }]).png().toBuffer();
const pixel = async (jpeg, x, y) => { const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true }); const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };

describe('composeStill', () => {
  it('a small light element in a corner is cropped, enlarged to fill the tile, and placed on the dark backdrop', async () => {
    const out = await composeStill(await frame({ x: 40, y: 440, w: 200, h: 50 }, { r: 255, g: 255, b: 255, alpha: 1 }));
    expect(out.kind).toBe('cropped'); expect(out.backdrop).toBe('dark');
    const meta = await sharp(out.jpeg).metadata();
    expect([meta.width, meta.height]).toEqual([TILE.w, TILE.h]);
    expect(await contentShare(out.jpeg)).toBeGreaterThan(0.2);             // it fills a good part of the tile now
    const [r, g, b] = await pixel(out.jpeg, TILE.w >> 1, TILE.h >> 1);      // centred
    expect(r + g + b).toBeGreaterThan(600);
    const [br, bg, bb] = await pixel(out.jpeg, 4, 4);
    expect(br + bg + bb).toBeLessThan(80);                                  // the dark backdrop at the corner
  });

  it('dark artwork (black type, dark bars) goes on the light backdrop, so it can be seen', async () => {
    const out = await composeStill(await frame({ x: 300, y: 200, w: 360, h: 80 }, { r: 10, g: 10, b: 10, alpha: 1 }));
    expect(out.backdrop).toBe('light');
    const [r, g, b] = await pixel(out.jpeg, 4, 4);
    expect(r + g + b).toBeGreaterThan(600);
    expect(await contentShare(out.jpeg)).toBeGreaterThan(0.2);
  });

  it('a full frame keeps its whole picture, and a render with nothing drawn is reported empty (not saved as a blank tile)', async () => {
    const full = await composeStill(await frame({ x: 0, y: 0, w: W, h: H }, { r: 200, g: 40, b: 40, alpha: 1 }));
    expect(full.kind).toBe('opaque'); expect(full.jpeg).toBeTruthy();
    const nothing = await composeStill(await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer());
    expect(nothing).toMatchObject({ kind: 'empty', jpeg: null });
    const specks = await composeStill(await frame({ x: 10, y: 10, w: 3, h: 3 }, { r: 255, g: 255, b: 255, alpha: 1 }));
    expect(specks.kind).toBe('empty');
  });

  it('a sparse full-frame overlay is shown over the real photo, and with no photo it is cropped as before', async () => {
    const photo = await sharp({ create: { width: 640, height: 360, channels: 3, background: { r: 200, g: 120, b: 60 } } }).jpeg().toBuffer();
    const marks = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: { create: { width: 24, height: 24, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }, left: 20, top: 20 }, { input: { create: { width: 24, height: 24, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }, left: W - 44, top: H - 44 }]).png().toBuffer();
    const out = await composeStill(marks, { photo });
    expect(out.kind).toBe('overlay'); expect(out.backdrop).toBe('photo');
    const [r, , b] = await pixel(out.jpeg, TILE.w >> 1, TILE.h >> 1);
    expect(r).toBeGreaterThan(b + 40);                                      // the orange photo shows through, not a flat backdrop
    expect((await composeStill(marks)).kind).toBe('cropped');
  });

  it('does not enlarge a tiny element past the zoom limit', async () => {
    const out = await composeStill(await frame({ x: 100, y: 100, w: 30, h: 12 }, { r: 255, g: 255, b: 255, alpha: 1 }));
    expect(out.kind).toBe('cropped');
    expect(await contentShare(out.jpeg)).toBeLessThan(0.5);               // still small rather than a smeared blow-up
  });
});
