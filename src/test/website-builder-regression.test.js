import { describe, it, expect } from 'vitest';
import * as router from '../lib/router.js';

describe('Website Builder regression', () => {
  it('router registers website-builder page loader', async () => {
    const mod = await import('../lib/router.js');
    expect(typeof mod.navigate).toBe('function');
    expect(mod.navigate).toBeDefined();
  });

  it('sidebar source contains website-builder route ID', async () => {
    const sidebar = await import('../components/Sidebar.js');
    expect(typeof sidebar.Sidebar).toBe('function');
  });

  it('website-builder loader resolves OpenThornStudio', async () => {
    const mod = await import('../components/OpenThornStudio.js');
    expect(typeof mod.OpenThornStudio).toBe('function');
  });

  it('OpenThornStudio returns an iframe container', async () => {
    const mod = await import('../components/OpenThornStudio.js');
    const container = mod.OpenThornStudio();
    expect(container).toBeDefined();
    expect(container.tagName).toBe('DIV');
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('loading')).toBe('lazy');
    // Code export needs downloads; deployed-site links need to escape the sandbox.
    const sandbox = iframe.getAttribute('sandbox').split(/\s+/);
    expect(sandbox).toEqual(expect.arrayContaining(['allow-scripts', 'allow-same-origin', 'allow-downloads', 'allow-popups-to-escape-sandbox']));
    expect(iframe.getAttribute('allow')).toContain('clipboard-write');
    expect(iframe.getAttribute('title')).toBe('Smart Website Builder');
    // The builder must open on its Dashboard, never the upstream marketing landing.
    expect(iframe.getAttribute('src')).toMatch(/\/dashboard$/);
  });

  it('builderAccess admits only signed-in paid accounts', async () => {
    const { builderAccess } = await import('../components/OpenThornStudio.js');
    const session = (paid) => ({ checkAuthorization: ({ feature }) => paid && feature === 'smartvideo_full_access' });
    expect(builderAccess(null)).toBe('signed_out');
    expect(builderAccess({ user: null, session: null })).toBe('signed_out');
    expect(builderAccess({ user: { publicMetadata: {} }, session: session(false) })).toBe('unpaid');
    expect(builderAccess({ user: { publicMetadata: {} }, session: session(true) })).toBe('paid');
    expect(builderAccess({ user: { publicMetadata: { legacy_access: true } }, session: session(false) })).toBe('paid');
  });
});
