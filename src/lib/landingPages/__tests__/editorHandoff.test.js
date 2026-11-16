// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const pages = vi.hoisted(() => ({ list: [] }));
vi.mock('../../supabase.js', () => ({ isSupabaseConfigured: () => true, getClerkUserId: () => 'user_1', primeSupabaseIdentity: async () => {}, supabase: {} }));
vi.mock('../client.js', async (orig) => ({ ...(await orig()), listPages: vi.fn(async () => pages.list) }));
vi.mock('../puck/mount.jsx', () => ({ mountPuckEditor: vi.fn(() => ({ destroy() {} })), mountPuckPage: vi.fn(() => ({ destroy() {} })) }));
vi.mock('../../studioChrome.js', () => ({ mountStudioChrome: () => {} }));

import { queuePageForEditor, takeQueuedPage, queueVideoForPage } from '../handoff.js';
import { TEMPLATES, defaultConfig } from '../templates.js';
import { LandingPagesStudio } from '../../../components/LandingPagesStudio.js';
import { mountPuckEditor } from '../puck/mount.jsx';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const page = (id, template = 'puck-leadiq') => ({ id, title: 'Launch video', video_url: 'https://x.test/v.mp4', poster_url: null, duration: 31, published: false, view_count: 0, source: {}, config: defaultConfig(template, { title: 'Launch video' }) });

describe('"Open in Editor" hand-off', () => {
  it('queues a page id once, and only a real one', () => {
    const storage = memory();
    expect(queuePageForEditor('abc12345xy', { storage })).toBe(true);
    expect(takeQueuedPage({ storage })).toBe('abc12345xy');
    expect(takeQueuedPage({ storage })).toBeNull();           // taken once
    expect(queuePageForEditor('../etc', { storage })).toBe(false);
    expect(queuePageForEditor('', { storage })).toBe(false);
    expect(takeQueuedPage({ storage })).toBeNull();
  });

  it('expires after two minutes, ignores a broken value, and survives storage that throws', () => {
    const storage = memory(); const t = 1_000_000;
    queuePageForEditor('abc12345xy', { storage, now: () => t });
    expect(takeQueuedPage({ storage, now: () => t + 3 * 60 * 1000 })).toBeNull();
    storage.setItem('video_pages_open_page', '{not json');
    expect(takeQueuedPage({ storage })).toBeNull();
    const bad = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => {} };
    expect(queuePageForEditor('abc12345xy', { storage: bad })).toBe(false);
    expect(takeQueuedPage({ storage: bad })).toBeNull();
  });
});

describe('Video Pages studio', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  beforeEach(() => { vi.stubGlobal('localStorage', memory()); vi.stubGlobal('sessionStorage', memory()); document.body.innerHTML = ''; vi.clearAllMocks(); pages.list = [page('abc12345xy'), page('zzz98765qq', 'clean')]; });

  it('starts in the editor of a queued page (the "Open in Editor" button of the Add to Video Pages window)', async () => {
    queuePageForEditor('abc12345xy');
    const root = LandingPagesStudio(); document.body.appendChild(root);
    await vi.waitFor(() => expect(root.querySelector('input[aria-label="Page title"]')?.value).toBe('Launch video'));
    await vi.waitFor(() => expect(mountPuckEditor).toHaveBeenCalledTimes(1));
    expect(mountPuckEditor.mock.calls[0][1].data).toBeTruthy();           // the design's page data is what Puck loads
    expect(globalThis.localStorage.getItem('video_pages_open_page')).toBeNull();     // used up
  });

  it('with no queued page it shows the list; a queued page that is not there falls back to the list', async () => {
    let root = LandingPagesStudio(); document.body.appendChild(root);
    await vi.waitFor(() => expect(root.textContent).toContain('Landing pages for your videos'));
    expect(mountPuckEditor).not.toHaveBeenCalled();
    document.body.innerHTML = '';
    queuePageForEditor('nope000000');
    root = LandingPagesStudio(); document.body.appendChild(root);
    await vi.waitFor(() => expect(root.textContent).toContain('Landing pages for your videos'));
    expect(mountPuckEditor).not.toHaveBeenCalled();
  });

  it('the New page picker shows the real preview of every design, and a wireframe when a picture fails to load', async () => {
    expect(queueVideoForPage({ url: 'https://x.test/v.mp4', type: 'video', prompt: 'Launch video' })).toBe(true);
    const root = LandingPagesStudio(); document.body.appendChild(root);
    await vi.waitFor(() => expect(root.textContent).toContain('New video page'));
    await vi.waitFor(() => expect(root.querySelectorAll('img[data-design-preview]').length).toBe(TEMPLATES.filter((t) => !t.site).length));
    const first = root.querySelector('img[data-design-preview="puck-leadiq"]');
    expect(first.getAttribute('src')).toBe('/landing-previews/puck-leadiq.jpg');
    const card = first.closest('div');
    first.dispatchEvent(new Event('error'));
    expect(card.querySelector('svg')).toBeTruthy();                       // the page's shape stands in
    expect(card.querySelector('img')).toBeNull();
  });
});
