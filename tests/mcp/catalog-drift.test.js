// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Regenerates mcp/catalog.json from src/lib/models.js and fails if it differs from the committed file.
describe('mcp/catalog.json is in sync with the app model registry', () => {
  it('matches a fresh build', () => {
    const committed = readFileSync(new URL('../../mcp/catalog.json', import.meta.url), 'utf8');
    const backup = join(mkdtempSync(join(tmpdir(), 'mcp-')), 'catalog.json');
    copyFileSync(new URL('../../mcp/catalog.json', import.meta.url), backup);
    try {
      execFileSync('node', ['scripts/build-mcp-catalog.mjs'], { cwd: new URL('../..', import.meta.url).pathname, stdio: 'pipe' });
      expect(readFileSync(new URL('../../mcp/catalog.json', import.meta.url), 'utf8') === committed, 'run: npm run mcp:catalog').toBe(true);
    } finally {
      writeFileSync(new URL('../../mcp/catalog.json', import.meta.url), committed);
    }
  });
});
