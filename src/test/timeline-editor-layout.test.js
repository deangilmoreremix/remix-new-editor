import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(path.join(process.cwd(), 'src/components/TimelineEditorPage.jsx'), 'utf8');
const css = readFileSync(path.join(process.cwd(), 'styles/timeline-editor-page.css'), 'utf8');

describe('Timeline Editor page layout', () => {
  it('keeps the side panels inside the editor grid, next to the preview', () => {
    const open = '<div class="main-grid">';
    const a = src.indexOf(open);
    const b = src.indexOf('<div class="side-col">');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    const between = src.slice(a + open.length, b).replace(/<!--[\s\S]*?-->/g, '');
    const opens = (between.match(/<div\b/g) || []).length;
    const closes = (between.match(/<\/div>/g) || []).length;
    // Every div opened in the left column is closed before the side column
    // starts. One extra close pushed the panels out of the grid, below the page.
    expect(closes).toBe(opens);
  });

  it('describes bottom toolbar buttons with a tip the scrolling bar cannot clip', () => {
    expect(src).toContain('function installRailTooltip()');
    expect(css).toMatch(/\.rail-tip\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.floating-rail \.rail-btn\[data-tooltip\]::after\s*\{\s*display:\s*none/);
  });

  it('leaves room under the page for the fixed bottom toolbar', () => {
    expect(css).toMatch(/\.app-shell\s*\{[^}]*padding-bottom:\s*120px/);
  });
});
