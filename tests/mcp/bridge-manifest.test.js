// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { buildBridgeManifest } from '../../src/lib/mcpBridge/manifest.js';
import { humanOnlyViolations } from '../../packages/studio-mcp-core/src/governor.js';

const FILE = new URL('../../mcp/bridge-tools.json', import.meta.url);
const built = buildBridgeManifest();

if (process.env.UPDATE_BRIDGE_MANIFEST === '1') fs.writeFileSync(FILE, `${JSON.stringify(built, null, 2)}\n`);

describe('mcp/bridge-tools.json', () => {
  it('matches what the adapters define (run `npm run mcp:bridge-manifest` after changing a tool)', () => {
    expect(JSON.parse(fs.readFileSync(FILE, 'utf8'))).toEqual(JSON.parse(JSON.stringify(built)));
  });
  it('every tool has a risk, a description and an object schema; names are unique and prefixed by studio', () => {
    const names = [];
    for (const [studio, list] of Object.entries(built.studios)) {
      for (const t of list) {
        names.push(t.name);
        expect(['read', 'write', 'destructive', 'publish']).toContain(t.risk);
        expect(t.description.length).toBeGreaterThan(3);
        expect(t.schema.type).toBe('object');
        if (!['app', 'brand', 'render'].includes(studio)) expect(t.name.startsWith(studio.replace('motion_director', 'motion_director'))).toBe(true);
      }
    }
    expect(new Set(names).size).toBe(names.length);
    expect(humanOnlyViolations(names)).toEqual([]);
  });
  it('no tool mentions the upstream generation provider', () => {
    expect(JSON.stringify(built)).not.toMatch(/mu-?api/i);
  });
});
