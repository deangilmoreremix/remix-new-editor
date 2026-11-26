// The left side menu is the app's only studio menu. These tests guard against
// the top bar or the studio pages growing their own menus again.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/muapi.js', () => ({ muapi: { getBalance: vi.fn().mockResolvedValue(null) } }));
vi.mock('../lib/apiKeyManager.js', () => ({ apiKeyManager: { clearMuapiKey: vi.fn() } }));

describe('single navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.location.hash = '';
  });

  it('top bar has no studio menu, only logo and account controls', async () => {
    const { Header } = await import('../components/Header.js');
    const navigate = vi.fn();
    const { header, headerAuthSlot } = Header(navigate);
    document.body.appendChild(header);

    expect(headerAuthSlot).toBeInstanceOf(HTMLElement);
    expect(header.querySelector('nav')).toBeNull();
    expect(header.textContent).not.toMatch(/Storyboard|Cinema Studio|Templates|Explore/);
    expect(document.querySelector('[data-mobile-menu]')).toBeNull();

    header.querySelector('[aria-label="All apps"]').click();
    expect(navigate).toHaveBeenCalledWith('apps');
  });

  it('studio pages get no menu, back button or drawer', async () => {
    const { mountStudioChrome } = await import('../lib/studioChrome.js');
    const root = document.createElement('div');
    document.body.appendChild(root);

    const result = mountStudioChrome(root, { currentRoute: 'image' });
    expect(result.topbar).toBeNull();
    expect(result.drawer).toBeNull();
    expect(root.querySelector('[data-studio-menu], [data-studio-back]')).toBeNull();
    expect(document.querySelector('[data-studio-drawer]')).toBeNull();
  });

  it('a titled studio keeps a plain title bar for its own actions', async () => {
    const { mountStudioChrome } = await import('../lib/studioChrome.js');
    const root = document.createElement('div');
    const { topbar } = mountStudioChrome(root, { title: 'Workbench' });
    expect(topbar.textContent).toContain('Workbench');
    expect(topbar.querySelector('button')).toBeNull();
    expect(root.firstChild).toBe(topbar);
  });

  it('side menu renders every NAV_GROUPS entry and highlights the current route', async () => {
    const { NAV_GROUPS } = await import('../lib/studioRoutes.js');
    window.location.hash = '#/cinema';
    const { Sidebar } = await import('../components/Sidebar.js');
    const { sidebar } = Sidebar(vi.fn());

    const ids = NAV_GROUPS.flatMap((g) => g.items.map((it) => it.id));
    const rendered = [...sidebar.querySelectorAll('[data-sidebar-item]')].map((el) => el.dataset.sidebarItem);
    expect(rendered).toEqual(expect.arrayContaining(ids));

    expect(sidebar.querySelector('[aria-current="page"]').dataset.sidebarItem).toBe('cinema');
    sidebar.dispatchEvent(new CustomEvent('route-changed', { detail: { page: 'brand-dna' } }));
    expect(sidebar.querySelector('[aria-current="page"]').dataset.sidebarItem).toBe('brand');
  });

  it('menu expands to full width and folds groups, and remembers both', async () => {
    localStorage.removeItem('sv:sidebar');
    window.location.hash = '#/image';
    const { Sidebar } = await import('../components/Sidebar.js');
    const { sidebar } = Sidebar(vi.fn());
    const toggle = sidebar.querySelector('[data-sidebar-toggle]');
    expect(sidebar.style.width).toBe('68px');
    toggle.click();
    expect(sidebar.style.width).toBe('232px');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const heading = sidebar.querySelector('[data-sidebar-group="Utilities"]');
    const body = sidebar.querySelector('[data-sidebar-group-body="Utilities"]');
    expect(heading.getAttribute('aria-expanded')).toBe('true');
    heading.click();
    expect(heading.getAttribute('aria-expanded')).toBe('false');
    expect(body.style.display).toBe('none');

    // A new menu picks both choices back up.
    const again = Sidebar(vi.fn()).sidebar;
    expect(again.style.width).toBe('232px');
    expect(again.querySelector('[data-sidebar-group-body="Utilities"]').style.display).toBe('none');

    // Going to a studio inside a folded group opens it.
    again.dispatchEvent(new CustomEvent('route-changed', { detail: { page: 'viral' } }));
    expect(again.querySelector('[data-sidebar-group-body="Utilities"]').style.display).toBe('');
  });

  it('Academy is in the side menu: opens the academy page and stays highlighted on tracks and lessons', async () => {
    window.location.hash = '#/academy';
    const { Sidebar } = await import('../components/Sidebar.js');
    const navigate = vi.fn();
    const { sidebar } = Sidebar(navigate);
    const btn = sidebar.querySelector('[data-sidebar-item="academy"]');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toContain('Academy');
    expect(sidebar.querySelector('[aria-current="page"]').dataset.sidebarItem).toBe('academy');
    btn.click();
    expect(navigate).toHaveBeenCalledWith('academy');
    for (const page of ['academy/track/02-ai-filmmaking', 'academy/track/06-ai-audio-and-music/lesson/06-ai-audio-and-music::04-music-sfx-generation']) {
      sidebar.dispatchEvent(new CustomEvent('route-changed', { detail: { page } }));
      expect(sidebar.querySelector('[aria-current="page"]').dataset.sidebarItem).toBe('academy');
    }
  });
});
