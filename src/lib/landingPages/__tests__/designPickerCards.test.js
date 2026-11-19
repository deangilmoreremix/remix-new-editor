// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const pages = vi.hoisted(() => ({ list: [] }));
vi.mock('../../supabase.js', () => ({ isSupabaseConfigured: () => true, getClerkUserId: () => 'user_1', primeSupabaseIdentity: async () => {}, supabase: {} }));
vi.mock('../client.js', async (orig) => ({ ...(await orig()), listPages: vi.fn(async () => pages.list) }));
vi.mock('../editor/mount.jsx', () => ({ mountPageEditor: vi.fn(() => ({ destroy() {} })), mountEditablePage: vi.fn(() => ({ destroy() {} })) }));
vi.mock('../../studioChrome.js', () => ({ mountStudioChrome: () => {} }));

import { queueVideoForPage } from '../handoff.js';
import { TEMPLATES, defaultConfig } from '../templates.js';
import { LandingPagesStudio } from '../../../components/LandingPagesStudio.js';
import { mountPageEditor } from '../editor/mount.jsx';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };
const page = (id, template = 'editable-leadiq') => ({ id, title: 'Launch video', video_url: 'https://x.test/v.mp4', poster_url: null, duration: 31, published: false, view_count: 0, source: {}, config: defaultConfig(template, { title: 'Launch video' }) });

describe('Video Pages studio', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  beforeEach(() => { vi.stubGlobal('localStorage', memory()); vi.stubGlobal('sessionStorage', memory()); document.body.innerHTML = ''; vi.clearAllMocks(); pages.list = [page('abc12345xy'), page('zzz98765qq', 'clean')]; });

  it('with no queued video it shows the list of pages', async () => {
    const root = LandingPagesStudio(); document.body.appendChild(root);
    await vi.waitFor(() => expect(root.textContent).toContain('Landing pages for your videos'));
    expect(mountPageEditor).not.toHaveBeenCalled();
  });

  it('the New page picker: editable designs show a live preview of the page, every other design shows its picture, and a wireframe stands in when a picture fails to load', async () => {
    expect(queueVideoForPage({ url: 'https://x.test/v.mp4', type: 'video', prompt: 'Launch video' })).toBe(true);
    const root = LandingPagesStudio(); document.body.appendChild(root);
    await vi.waitFor(() => expect(root.textContent).toContain('New video page'));
    const others = TEMPLATES.filter((t) => !t.site && !t.editable);
    await vi.waitFor(() => expect(root.querySelectorAll('img[data-design-preview]').length).toBe(others.length));
    const first = root.querySelector('img[data-design-preview="clean"]');
    expect(first.getAttribute('src')).toBe('/landing-previews/clean.jpg');
    expect(root.querySelector('img[data-design-preview="editable-leadiq"]')).toBeNull();   // an editable design is drawn live instead
    const card = first.closest('div');
    first.dispatchEvent(new Event('error'));
    expect(card.querySelector('svg')).toBeTruthy();                       // the page's shape stands in
    expect(card.querySelector('img')).toBeNull();
  });
});
