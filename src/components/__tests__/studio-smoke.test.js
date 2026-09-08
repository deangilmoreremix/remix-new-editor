import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const componentsDir = join(import.meta.dirname, '..');
const studioFiles = readdirSync(componentsDir)
  .filter(f => f.endsWith('.js') && /Studio\.js$|Page\.js$/.test(f) && !f.endsWith('.test.js'));

describe('Studio runtime smoke tests', () => {
  let errors = [];
  let consoleError;
  let windowError;

  beforeEach(() => {
    errors = [];
    consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    windowError = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    windowError.mockRestore();
  });

  for (const file of studioFiles) {
    it(`${file} mounts without ReferenceError`, async () => {
      const fullPath = join(componentsDir, file);
      const source = readFileSync(fullPath, 'utf8');
      const factoryMatch = source.match(/export\s+(?:async\s+)?function\s+(\w+)\s*\(/);
      if (!factoryMatch) {
        console.warn(`  Skipping ${file}: no exported factory found`);
        return;
      }
      const factoryName = factoryMatch[1];

        const module = await import(`../${file}`);
      const factory = module[factoryName];
      if (typeof factory !== 'function') {
        console.warn(`  Skipping ${file}: factory ${factoryName} not callable`);
        return;
      }

      const container = document.createElement('div');
      container.id = 'studio-root';
      document.body.appendChild(container);

      try {
        const result = factory();
        if (result && typeof result.then === 'function') {
          await result;
        }
      } catch (err) {
        console.error(`[SMOKE] ${file} mount threw:`, err);
        throw err;
      }

      const refErrors = errors.filter(e => /ReferenceError|TypeError/.test(e));
      expect(refErrors).toEqual([]);
    });
  }
});
