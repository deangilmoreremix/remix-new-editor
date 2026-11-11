import { afterEach, describe, expect, it } from 'vitest';
import { LOOKS, skinLooks } from '../demosrc/_fixtures/Look';
import { BRAND, setBrand } from '../demosrc/_fixtures/Brand';

afterEach(() => setBrand(null));
const designed = JSON.stringify(LOOKS);

describe('skinLooks', () => {
  it('paints the looks in a dark company\'s colours and restores them', () => {
    const before = JSON.parse(designed);
    skinLooks({ accent: '#2f80ff', ink: '#f5f7ff', paper: '#0b1020' });
    // Dark looks follow the brand's background and ink, accents follow the brand everywhere.
    expect(LOOKS.midnight.accent).toBe('#2f80ff');
    expect(LOOKS.midnight.bg[1]).toBe('#0b1020');
    expect(LOOKS.midnight.ink).toBe('#f5f7ff');
    expect(LOOKS.ember.bg[1]).toBe('#0b1020');
    // A light look keeps its own paper and ink (a dark brand must not make them vanish), but takes the accent.
    expect(LOOKS.paper.bg).toEqual(before.paper.bg);
    expect(LOOKS.paper.ink).toBe(before.paper.ink);
    expect(LOOKS.paper.accent).toBe('#2f80ff');
    // Graphite stays monochrome: white accent, the brand colour as its second tone.
    expect(LOOKS.graphite.accent).toBe(before.graphite.accent);
    expect(LOOKS.graphite.accent2).toBe('#2f80ff');
    skinLooks(null);
    expect(JSON.stringify(LOOKS)).toBe(designed);
  });

  it('follows a light company on the light looks only', () => {
    skinLooks({ accent: '#c2410c', ink: '#1c1917', paper: '#faf7f2' });
    expect(LOOKS.porcelain.bg[1]).toBe('#faf7f2');
    expect(LOOKS.porcelain.ink).toBe('#1c1917');
    expect(LOOKS.midnight.bg).toEqual(JSON.parse(designed).midnight.bg);
    expect(LOOKS.midnight.accent).toBe('#c2410c');
    expect(LOOKS.midnight.onAccent).toBe('#ffffff');
  });

  it('is driven by setBrand: a company film skins them, the studio\'s own demos do not', () => {
    setBrand({ name: 'Acme', accent: '#16a34a', accent2: '#0ea5e9', ink: '#ffffff', paper: '#05140b' });
    expect(BRAND.name).toBe('Acme');
    expect(LOOKS.lime.accent).toBe('#16a34a');
    expect(LOOKS.lime.accent2).toBe('#0ea5e9');
    setBrand(null);
    expect(JSON.stringify(LOOKS)).toBe(designed);
  });
});
