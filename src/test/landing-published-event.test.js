import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

describe('Landing pages: publishing tells the checklist', () => {
  it('dispatches landing:published after a save that leaves the page published', () => {
    const src = fs.readFileSync('src/components/LandingPagesStudio.js', 'utf8');
    const i = src.indexOf("new CustomEvent('landing:published'");
    expect(i).toBeGreaterThan(0);
    const before = src.slice(Math.max(0, i - 300), i);
    expect(before).toContain('if (current.published)');
    expect(before).toContain('drawShare()');
  });
});
