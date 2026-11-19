// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../../muapi.js', () => ({ muapi: {} }));

const { NAV_GROUPS } = await import('../../studioRoutes.js');
const { TOUR_LIST, TOURS, routeId, tourForPage, shellTour } = await import('../registry.js');

const navIds = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));

describe('tour registry', () => {
  it('has the app tour and a tour for every side-menu item, plus Outreach', () => {
    expect(shellTour().steps.length).toBeGreaterThanOrEqual(8);
    for (const id of [...navIds, 'outreach']) expect(TOURS[id], `missing tour for ${id}`).toBeTruthy();
  });
  it('every tour is well formed: unique id, matching route, version, 2+ steps with a title and a body', () => {
    const ids = TOUR_LIST.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOUR_LIST) {
      expect(t.version, t.id).toBeGreaterThanOrEqual(1);
      expect(t.id === 'app' ? t.route === '*' : t.route === t.id, `${t.id} route`).toBe(true);
      expect(t.steps.length, `${t.id} steps`).toBeGreaterThanOrEqual(t.id === 'app' ? 8 : 2);
      for (const s of t.steps) {
        expect(s.title, `${t.id} title`).toBeTruthy();
        expect(s.body, `${t.id}/${s.title} body`).toBeTruthy();
        expect(s.title.length, `${t.id}/${s.title}`).toBeLessThanOrEqual(60);
        expect(s.body.length, `${t.id}/${s.title}`).toBeLessThanOrEqual(260);
        expect(s.target === null || typeof s.target === 'string' || typeof s.target === 'function' || Array.isArray(s.target), `${t.id}/${s.title} target`).toBe(true);
      }
    }
  });
  it('studio tours never point at a Generate-style button to click (they only highlight)', () => {
    for (const t of TOUR_LIST) for (const s of t.steps) expect(/\bclick (the )?generate\b/i.test(s.body), `${t.id}/${s.title}`).toBe(false);
  });
  it('every data-tour hook a tour relies on exists in the source', () => {
    const wanted = new Set();
    for (const t of TOUR_LIST) for (const s of t.steps) for (const sel of [].concat(typeof s.target === 'string' || Array.isArray(s.target) ? s.target : [])) {
      for (const m of String(sel).matchAll(/\[data-tour="([\w-]+)"\]/g)) wanted.add(m[1]);
    }
    const files = ['src/components', 'src/lib', 'src/components/studio', 'src/components/outreach'];
    const { readdirSync, statSync } = require('node:fs');
    const all = [];
    const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/node_modules|__tests__/.test(p)) walk(p); } else if (/\.(js|jsx)$/.test(f)) all.push(p); } };
    walk(join(process.cwd(), 'src'));
    const text = all.filter((p) => !p.includes('/lib/tours/')).map((p) => readFileSync(p, 'utf8')).join('\n');
    void files;
    for (const name of wanted) {
      const present = new RegExp(`(dataset\\.tour\\s*=\\s*['"]${name}['"])|(data-tour['"]?\\s*[,=]\\s*['"]${name}['"])|(data-tour="${name}")`).test(text);
      expect(present, `data-tour="${name}" is used by a tour but never set`).toBe(true);
    }
  });
  it('maps routes and aliases to tour ids', () => {
    expect(routeId('#/image?x=1')).toBe('image');
    expect(routeId('academy/track/x/lesson/y')).toBe('academy');
    expect(routeId('template/abc')).toBe('');
    expect(routeId('cinegen')).toBe('workbench');
    expect(tourForPage('video-agent-studio')?.id).toBe('video-agent');
    expect(tourForPage('app')).toBeNull();
    expect(tourForPage('settings')).toBeNull();
  });
  it('static assets exist', () => {
    expect(existsSync(join(process.cwd(), 'src/styles/tours.css'))).toBe(true);
  });
});
