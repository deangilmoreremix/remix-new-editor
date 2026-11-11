// [remix] Every labelled control in the Edit tab, shell and Export tab must have hover help (name, summary, definition, how to use).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { resolveHelp, HELP } from '../lib/help/help-content';

const ROOT = path.resolve(__dirname, '..', 'components');
const DIRS = ['edit', 'workspace', 'export', 'home'];

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(path.join(dir, d.name)) : d.name.endsWith('.tsx') ? [path.join(dir, d.name)] : []));
}

/** Static labels written as title="..." / aria-label="..." / data-help="..." on a control. */
function labels(): Array<{ file: string; label: string }> {
  const out: Array<{ file: string; label: string }> = [];
  for (const d of DIRS) {
    for (const f of files(path.join(ROOT, d))) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\b(?:title|aria-label|data-help)="([^"{}]+)"/g)) out.push({ file: path.relative(ROOT, f), label: m[1] });
    }
  }
  return out;
}

// Labels that are not controls (they name content, not an action) or that only repeat visible text next to them.
const NOT_CONTROLS = new Set<string>([
  'Left panel', 'Library categories', 'Animation groups', 'Categories', 'Type', // [remix] landmark/tablist containers, not controls
  'Loading project', 'Processing media...', 'Copilot is thinking', 'Copilot response ready', 'Response ready', 'Navigate to page', 'Go up', 'Back to list',
  'Edit workspace', 'File not found — source file has been moved or deleted', 'Add overlay', 'Pack URL', 'Expected SHA-256 (optional)', 'Click to select',
]);

describe('hover help coverage', () => {
  it('every entry is complete (name, summary, definition, steps)', () => {
    for (const [key, h] of Object.entries(HELP)) {
      expect(h.name, key).toBeTruthy();
      expect(h.summary.length, key).toBeGreaterThan(8);
      expect(h.what.length, key).toBeGreaterThan(20);
      expect(h.how.length, key).toBeGreaterThan(0);
    }
  });

  it('every static control label in the editor resolves to help', () => {
    const missing = labels().filter((l) => !NOT_CONTROLS.has(l.label) && !resolveHelp(l.label));
    expect(missing.map((m) => `${m.file}: ${m.label}`)).toEqual([]);
  });

  it('handles a shortcut suffix and state-dependent labels', () => {
    expect(resolveHelp('Blade Tool (B)')?.shortcut).toBe('B');
    expect(resolveHelp('Snap ON (S)')?.name).toBe('Snap');
    expect(resolveHelp('Snap OFF (S)')?.name).toBe('Snap');
    expect(resolveHelp('Gain +0.0dB')?.name).toBe('Clip gain');
    expect(resolveHelp('Something nobody wrote help for')).toBeNull();
  });
});
