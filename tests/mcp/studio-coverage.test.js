// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { GENERATION_TOOLS } from '../../packages/studio-mcp-core/src/server.js';
import { customTools } from '../../mcp/tools.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const manifest = JSON.parse(read('../../mcp/studios.json'));
const catalog = JSON.parse(read('../../mcp/catalog.json'));

// Studios in the app = keys of pageLoaders in src/lib/router.js (plus retired ones, which must NOT be exposed).
const router = read('../../src/lib/router.js');
const body = router.slice(router.indexOf('const pageLoaders = {'), router.indexOf('// Sub-paths like'));
const appStudios = [...body.matchAll(/^\s*(?:'([^']+)'|([A-Za-z0-9_]+)):\s*\(\)/gm)].map((m) => m[1] || m[2]);
const retired = [...router.slice(router.indexOf('RETIRED_ROUTES'), router.indexOf('const pageLoaders')).matchAll(/^\s*'?([\w-]+)'?:/gm)].map((m) => m[1]);

const toolNames = new Set([...GENERATION_TOOLS.map((t) => t.name), ...customTools.map((t) => t.name), 'list_studios', 'search_models', 'get_model', 'estimate_cost', 'get_result', 'upload_file', 'account_balance']);
const kindsInCatalog = new Set(catalog.map((e) => e.kind));

describe('every studio in the app is classified', () => {
  it('has a manifest entry (supported or unsupported-with-reason) for each studio', () => {
    const classified = new Set([...Object.keys(manifest.supported), ...Object.keys(manifest.unsupported)]);
    expect(appStudios.length).toBeGreaterThan(40);
    expect(appStudios.filter((s) => !classified.has(s)), 'new studios need a manifest entry in mcp/studios.json').toEqual([]);
    expect([...classified].filter((s) => !appStudios.includes(s)), 'manifest lists studios that no longer exist').toEqual([]);
  });

  it('never lists a studio as both supported and unsupported, and every unsupported has a reason', () => {
    for (const s of Object.keys(manifest.supported)) expect(manifest.unsupported[s]).toBeUndefined();
    for (const [s, why] of Object.entries(manifest.unsupported)) expect(why.length, s).toBeGreaterThan(10);
  });

  it('does not expose retired studios', () => {
    expect(retired).toContain('training');
    for (const r of retired) expect(manifest.supported[r]).toBeUndefined();
    expect(kindsInCatalog.has('training')).toBe(false);
    // text models stay: Brand and Campaign call them. Only the retired Chat studio's tag must be gone.
    for (const e of catalog) for (const r of retired) expect(e.studios, `${e.key} tagged with retired studio ${r}`).not.toContain(r);
  });
});

describe('every supported studio is actually reachable', () => {
  for (const [studio, { tools, kinds }] of Object.entries(manifest.supported)) {
    it(studio, () => {
      for (const t of tools) expect(toolNames.has(t), `tool ${t}`).toBe(true);
      for (const k of kinds) {
        expect(kindsInCatalog.has(k), `catalog kind ${k}`).toBe(true);
        // a tool serving this kind must exist
        expect(GENERATION_TOOLS.some((g) => g.kinds.includes(k) && tools.includes(g.name)), `no listed tool serves kind ${k}`).toBe(true);
      }
    });
  }

  it('catalog has no models for studios outside the manifest', () => {
    const known = new Set(Object.keys(manifest.supported));
    for (const e of catalog) for (const s of e.studios) expect(known.has(s), `${e.key} tagged with unknown studio ${s}`).toBe(true);
  });
});

// ── Features: every tool is mapped to a feature, or the feature says why it is not exposed ──────────
describe('features', () => {
  const bridge = JSON.parse(read('../../mcp/bridge-tools.json'));
  const bridgeNames = Object.values(bridge.studios).flat().map((t) => t.name);
  const items = Object.values(manifest.features).flatMap((g) => Object.entries(g.items));
  const mapped = new Set(items.flatMap(([, v]) => v.tools || []));

  it('every feature is either tools that exist or a reason', () => {
    for (const [name, v] of items) {
      expect(Boolean(v.tools) !== Boolean(v.notExposed), `${name}: give tools or notExposed, not both`).toBe(true);
      if (v.notExposed) expect(v.notExposed.length, name).toBeGreaterThan(15);
      for (const t of v.tools || []) expect(toolNames.has(t) || bridgeNames.includes(t), `feature "${name}" lists unknown tool ${t}`).toBe(true);
    }
  });
  it('every custom tool and every tab tool is mapped to a feature', () => {
    expect([...customTools.map((t) => t.name), ...bridgeNames].filter((n) => !mapped.has(n))).toEqual([]);
  });
  it('every "not exposed" the adapters declare is explained in a feature', () => {
    const explained = new Set(items.filter(([, v]) => v.notExposed).map(([k]) => k));
    for (const [studio, list] of Object.entries(bridge.notExposed)) for (const key of Object.keys(list)) expect(explained.has(key), `${studio}.${key} needs a feature entry with notExposed`).toBe(true);
  });
});
