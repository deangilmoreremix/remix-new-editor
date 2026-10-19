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
    expect(iframe.getAttribute('sandbox')).toBeTruthy();
    expect(iframe.getAttribute('title')).toBe('Website Builder');
  });
});
