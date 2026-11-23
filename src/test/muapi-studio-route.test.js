import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Studio registration', () => {
  it('has a router loader for the page', () => {
    const router = fs.readFileSync('src/lib/router.js', 'utf-8');
    expect(router).toContain("'muapi-studio': () => import('../components/MuapiStudioPage.js')");
    expect(router).toContain("'Studio': 'muapi-studio'");
  });

  it('is listed once in the shared side menu, with a label, icon and category', async () => {
    const { NAV_GROUPS, STUDIO_ROUTES, getStudioIcon } = await import('../lib/studioRoutes.js');
    const ids = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    expect(ids.filter((id) => id === 'muapi-studio')).toHaveLength(1);
    expect(STUDIO_ROUTES['muapi-studio']).toMatchObject({ label: 'Studio' });
    expect(getStudioIcon('muapi-studio')).toContain('<svg');
  });

  it('mounts the vendored studio with the user key via the app proxy, never a shared key', () => {
    const page = fs.readFileSync('src/components/MuapiStudioPage.js', 'utf-8');
    expect(page).toContain("import('muapi-studio')");
    expect(page).toContain('apiKeyManager.getMuapiKey()');
    expect(page).toContain('fetchImpl: studioFetch');
    expect(page).not.toMatch(/VITE_[A-Z_]*MUAPI[A-Z_]*KEY/);
    expect(page).toContain('container.cleanup');
  });

  it('declares the vendored package as a file dependency', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    expect(pkg.dependencies['muapi-studio']).toBe('file:vendor/muapi-studio');
    expect(fs.existsSync('vendor/muapi-studio/index.js')).toBe(true);
    expect(fs.existsSync('vendor/muapi-studio/style.css')).toBe(true);
  });

  it('the vendored Studio renders outline buttons natively (lime theme), with no fill in its outline rules', () => {
    const css = fs.readFileSync('vendor/muapi-studio/style.css', 'utf-8');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /data-btn=["']?outline/.test(m[1]));
    expect(rules.length).toBeGreaterThan(3);
    for (const [, sel, body] of rules) {
      for (const d of body.split(';')) {
        const v = /^\s*background(?:-color)?\s*:\s*(.+)$/i.exec(d)?.[1].trim().replace(/\s*!important/, '');
        if (v) expect(/^(transparent|none)$/i.test(v), `${sel.trim().slice(0, 60)} sets background: ${v}`).toBe(true);
      }
    }
    expect(fs.readFileSync('vendor/muapi-studio/index.js', 'utf-8')).toMatch(/buttonStyle:\s*["']outline["']/);
  });
});
