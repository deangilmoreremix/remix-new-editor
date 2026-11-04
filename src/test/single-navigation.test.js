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
});

describe('studio page title', () => {
  it('is a one-line text title with no picture banner', async () => {
    const { createStudioHeader } = await import('../lib/thumbnails.js');
    const el = createStudioHeader('image', 'Image Studio', 'Generate images with 20+ AI models', 'mb-4');

    expect(el.dataset.studioHeader).toBe('image');
    expect(el.querySelector('h1').textContent).toBe('Image Studio');
    expect(el.textContent).toContain('Generate images with 20+ AI models');
    expect(el.querySelector('img')).toBeNull();
    expect(el.classList.contains('hero-banner')).toBe(false);
    expect(el.className).not.toMatch(/\bh-(24|28|32|44)\b/);
    expect(el.classList.contains('mb-4')).toBe(true);
  });

  it('omits the description when none is given', async () => {
    const { createStudioHeader } = await import('../lib/thumbnails.js');
    const el = createStudioHeader('library', 'Library');
    expect(el.querySelector('p')).toBeNull();
  });
});
