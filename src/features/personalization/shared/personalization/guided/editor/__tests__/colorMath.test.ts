import { describe, it, expect } from 'vitest';
import {
  autoTextColor, averageColor, contrastBetween, extractPalette, gradeContrast, hexToHsv, hexToRgb, hsvToHex, hsvToRgb,
  parseHex, pushRecent, rgbToHex, rgbToHsv,
} from '../colorMath';

describe('parseHex', () => {
  it('normalizes #rgb, #rrggbb and hash-less input to lowercase #rrggbb', () => {
    expect(parseHex('#FFF')).toBe('#ffffff');
    expect(parseHex('29D3F2')).toBe('#29d3f2');
    expect(parseHex('  #28c98b ')).toBe('#28c98b');
  });
  it('rejects anything else', () => {
    for (const bad of ['', '#12', '#12345', '#gggggg', 'red', 'rgb(1,2,3)', null, undefined]) expect(parseHex(bad as never)).toBeNull();
  });
});

describe('RGB <-> HSV', () => {
  it('maps the primaries and grays', () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, v: 1 });
    expect(rgbToHsv({ r: 0, g: 255, b: 0 }).h).toBeCloseTo(120, 5);
    expect(rgbToHsv({ r: 0, g: 0, b: 255 }).h).toBeCloseTo(240, 5);
    expect(rgbToHsv({ r: 128, g: 128, b: 128 }).s).toBe(0);
    expect(rgbToHsv({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 });
  });
  it('round-trips colors through HSV', () => {
    for (const hex of ['#29d3f2', '#28c98b', '#ff6b6b', '#e8a30a', '#000000', '#ffffff', '#7a3cff']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });
  it('wraps hue and clamps saturation/value', () => {
    expect(hsvToRgb({ h: 360, s: 1, v: 1 })).toEqual(hsvToRgb({ h: 0, s: 1, v: 1 }));
    expect(hsvToRgb({ h: -120, s: 1, v: 1 })).toEqual(hsvToRgb({ h: 240, s: 1, v: 1 }));
    expect(hsvToRgb({ h: 10, s: 5, v: 9 })).toEqual(hsvToRgb({ h: 10, s: 1, v: 1 }));
  });
  it('rgbToHex clamps channels', () => {
    expect(rgbToHex({ r: 300, g: -4, b: 15.6 })).toBe('#ff0010');
    expect(hexToRgb('#102030')).toEqual({ r: 16, g: 32, b: 48 });
  });
});

describe('contrast helpers', () => {
  it('white on black is 21:1 and the grade thresholds are WCAG', () => {
    expect(contrastBetween('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(gradeContrast(21)).toBe('AAA');
    expect(gradeContrast(5)).toBe('AA');
    expect(gradeContrast(3.2)).toBe('large-text');
    expect(gradeContrast(1.5)).toBe('low');
  });
  it('autoTextColor picks the readable side', () => {
    expect(autoTextColor('#0a0a0a')).toBe('#ffffff');
    expect(autoTextColor('#f4e3b5')).toBe('#000000');
    expect(autoTextColor('#000000', '#ffffff')).toBe('#ffffff');
  });
});

const px = (...rgba: number[]) => new Uint8ClampedArray(rgba);

describe('palette extraction', () => {
  it('averages opaque pixels and ignores transparent ones', () => {
    expect(averageColor(px(255, 0, 0, 255, 0, 0, 255, 255, 9, 9, 9, 0))).toBe('#800080');
    expect(averageColor(px(1, 2, 3, 0))).toBeNull();
    expect(averageColor(px())).toBeNull();
  });
  it('returns the most common distinct colors, most common first', () => {
    const data: number[] = [];
    const add = (n: number, r: number, g: number, b: number) => { for (let i = 0; i < n; i++) data.push(r, g, b, 255); };
    add(50, 200, 20, 20);
    add(30, 20, 20, 200);
    add(20, 205, 25, 25); // a near-duplicate of the red: must not become its own swatch
    add(5, 20, 200, 20);
    const palette = extractPalette(new Uint8ClampedArray(data), 3);
    expect(palette).toHaveLength(3);
    expect(hexToRgb(palette[0]).r).toBeGreaterThan(190);
    expect(hexToRgb(palette[1]).b).toBeGreaterThan(190);
    expect(hexToRgb(palette[2]).g).toBeGreaterThan(190);
  });
  it('skips translucent pixels and handles empty input', () => {
    expect(extractPalette(px(10, 10, 10, 50))).toEqual([]);
    expect(extractPalette(px())).toEqual([]);
  });
});

describe('pushRecent', () => {
  it('puts the newest first, de-dupes, caps and ignores invalid colors', () => {
    expect(pushRecent(['#111111', '#222222'], '#222222')).toEqual(['#222222', '#111111']);
    expect(pushRecent(['#111111'], '#ABC')).toEqual(['#aabbcc', '#111111']);
    expect(pushRecent(['#111111'], 'nope')).toEqual(['#111111']);
    const long = Array.from({ length: 8 }, (_, i) => `#00000${i}`);
    expect(pushRecent(long, '#ffffff')).toHaveLength(8);
  });
});
