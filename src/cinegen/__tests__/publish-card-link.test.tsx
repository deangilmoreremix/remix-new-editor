// [remix] Publish card: readable /v/<business>/<slug> link, Custom link + own-domain editors, free MP4 download shortcut.
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const dispatch = vi.fn();
vi.mock('@cinegen/components/workspace/workspace-shell', () => ({ useWorkspace: () => ({ state: { overlays: [], timelines: [], activeTimelineId: '' }, dispatch }) }));
vi.mock('@cinegen/lib/leads/qr-end-card', () => ({ createQrEndCard: vi.fn(), mp4WatchLink: () => '' }));

import { PublishCard } from '../components/leads/publish-card';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const type = (input: HTMLInputElement, v: string) => act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v); input.dispatchEvent(new Event('input', { bubbles: true })); });
const makePub = (info: Record<string, unknown>) => ({
  id: 'abcdefgh12', info: { id: 'abcdefgh12', title: 'Intro', published: true, view_count: 0, ...info }, busy: false, error: '', loaded: true,
  publish: vi.fn(), setLive: vi.fn(), saveLink: vi.fn().mockResolvedValue(undefined), setDomain: vi.fn().mockResolvedValue(undefined), setPrivacy: vi.fn(),
  reload: vi.fn(), title: 'Intro', signedIn: true, guest: false,
});
const mount = (pub: ReturnType<typeof makePub>) => {
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  act(() => { root.render(<PublishCard pub={pub as never} leadCount={0} />); });
  return { host, cleanup: () => { act(() => root.unmount()); host.remove(); } };
};
const q = (host: HTMLElement, id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement;

describe('PublishCard link editing', () => {
  it('shows the random /watch link until a custom link is set, then the readable one', () => {
    const a = mount(makePub({}));
    expect((q(a.host, 'share-link') as HTMLInputElement).value).toMatch(/\/watch\/abcdefgh12$/);
    a.cleanup();
    const b = mount(makePub({ business: 'acme', slug: 'intro' }));
    expect((q(b.host, 'share-link') as HTMLInputElement).value).toMatch(/\/v\/acme\/intro$/);
    b.cleanup();
  });
  it('claims the business name and saves the slug', async () => {
    const pub = makePub({});
    const { host, cleanup } = mount(pub);
    type(q(host, 'link-business') as HTMLInputElement, 'Acme');
    type(q(host, 'link-slug') as HTMLInputElement, 'intro');
    await act(async () => { q(host, 'save-link').click(); });
    expect(pub.saveLink).toHaveBeenCalledWith('acme', 'intro');
    cleanup();
  });
  it('rejects a missing business name and an invalid slug without calling the database', async () => {
    const pub = makePub({});
    const { host, cleanup } = mount(pub);
    type(q(host, 'link-slug') as HTMLInputElement, 'intro');
    await act(async () => { q(host, 'save-link').click(); });
    expect(pub.saveLink).not.toHaveBeenCalled();
    expect(host.textContent).toMatch(/Choose a business name first/);
    cleanup();
  });
  it('saves an own domain once a business exists and shows the link on it', async () => {
    const pub = makePub({ business: 'acme', slug: 'intro', customDomain: 'videos.acme.com' });
    const { host, cleanup } = mount(pub);
    expect(q(host, 'domain-link').textContent).toContain('https://videos.acme.com/intro');
    type(q(host, 'link-domain') as HTMLInputElement, 'https://videos.acme.com/');
    await act(async () => { q(host, 'save-domain').click(); });
    expect(pub.setDomain).toHaveBeenCalledWith('https://videos.acme.com/');
    cleanup();
  });
  it('Download MP4 jumps to the Export tab', () => {
    const { host, cleanup } = mount(makePub({}));
    act(() => { q(host, 'download-mp4').click(); });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_TAB', tab: 'export' });
    cleanup();
  });
});
