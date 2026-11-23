// [remix] Export tab layout: every render option is visible at once, and no label is cut off.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../styles/globals.css'), 'utf8');
const rule = (selector: string) => {
  const m = css.match(new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
  return m ? m[2] : '';
};

describe('Export tab layout', () => {
  it('is wide enough for two columns', () => {
    const max = Number(rule('.export-tab__panel').match(/max-width:\s*(\d+)px/)?.[1]);
    expect(max).toBeGreaterThanOrEqual(1000);
    expect(rule('.export-tab__cols')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  });

  it('falls back to one column on narrow windows', () => {
    expect(css).toMatch(/@media \(max-width: 900px\)\s*\{\s*\.export-tab__cols\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  });

  it('does not clip select labels such as "16:9 landscape" and "Cover (fill frame)"', () => {
    const sel = rule('.export-settings__fps-select');
    expect(sel).not.toMatch(/(^|[^-])width:\s*120px/);
    expect(Number(sel.match(/min-width:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(160);
  });

  it('lays out render options on the left and the output (personalized videos, links, FCPXML) on the right', () => {
    const tab = readFileSync(resolve(__dirname, '../components/export/export-tab.tsx'), 'utf8');
    expect(tab.indexOf('export-col-settings')).toBeGreaterThan(-1);
    expect(tab.indexOf('export-col-settings')).toBeLessThan(tab.indexOf('export-col-output'));
    const out = tab.slice(tab.indexOf('export-col-output'));
    expect(out).toContain('<PersonalizedOutput');
    expect(out).toContain('export-fcpxml');
  });
});
