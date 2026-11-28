// [remix] Publish card: says whether Retarget got connected to the video that was just published.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

const dispatch = vi.fn();
const timeline = vi.hoisted(() => ({ clips: 0 }));
vi.mock('@cinegen/components/workspace/workspace-shell', () => ({
  useWorkspace: () => ({ state: { overlays: [], activeTimelineId: 't', timelines: [{ id: 't', tracks: [{ id: 'tv', kind: 'video' }, { id: 'ta', kind: 'audio' }], clips: [...Array.from({ length: timeline.clips }, (_, i) => ({ id: `c${i}`, trackId: 'tv' })), { id: 'au', trackId: 'ta' }] }] }, dispatch }),
}));
vi.mock('@cinegen/lib/leads/qr-end-card', () => ({ createQrEndCard: vi.fn(), mp4WatchLink: () => '' }));

import { PublishCard } from '../components/leads/publish-card';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const makePub = (retarget: 'on' | 'guest' | 'failed' | null) => ({
  id: 'abcdefgh12', info: { id: 'abcdefgh12', title: 'Intro', published: true, view_count: 0 }, busy: false, error: '', loaded: true, retarget,
  publish: vi.fn(), setLive: vi.fn(), saveLink: vi.fn(), setDomain: vi.fn(), setPrivacy: vi.fn(), reload: vi.fn(), title: 'Intro', signedIn: true, guest: retarget === 'guest',
});
const mount = (retarget: 'on' | 'guest' | 'failed' | null) => {
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  act(() => { root.render(<PublishCard pub={makePub(retarget) as never} leadCount={0} />); });
  return { host, cleanup: () => { act(() => root.unmount()); host.remove(); } };
};
const q = (host: HTMLElement, id: string) => host.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

beforeEach(() => { dispatch.mockClear(); timeline.clips = 3; });

describe('PublishCard Retarget status', () => {
  it('shows nothing before a publish has reported', () => {
    const { host, cleanup } = mount(null);
    expect(q(host, 'retarget-status')).toBeNull();
    cleanup();
  });
  it('when connected: offers Open Retarget, which requests the view and opens Analytics', () => {
    const { host, cleanup } = mount('on');
    expect(q(host, 'retarget-status')!.textContent).toMatch(/Retarget is on/);
    const heard = vi.fn();
    window.addEventListener('remix:open-retarget', heard);
    act(() => { q(host, 'open-retarget')!.click(); });
    window.removeEventListener('remix:open-retarget', heard);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_TAB', tab: 'analytics' });
    cleanup();
  });
  it('for a guest: says Retarget needs an account', () => {
    const { host, cleanup } = mount('guest');
    expect(q(host, 'retarget-status')!.textContent).toMatch(/needs an account/);
    expect(q(host, 'open-retarget')).toBeNull();
    cleanup();
  });
  it('when linking failed: says so instead of failing silently', () => {
    const { host, cleanup } = mount('failed');
    expect(q(host, 'retarget-status')!.textContent).toMatch(/could not be connected/);
    cleanup();
  });
});

describe('PublishCard scene hint', () => {
  it('tells the owner Retarget needs two scenes when the timeline has fewer (audio clips do not count)', () => {
    timeline.clips = 1;
    const one = mount(null);
    expect(q(one.host, 'retarget-scenes-hint')!.textContent).toMatch(/at least two scenes.*one/);
    one.cleanup();
    timeline.clips = 0;
    const none = mount(null);
    expect(q(none.host, 'retarget-scenes-hint')!.textContent).toMatch(/none/);
    none.cleanup();
  });
  it('says nothing with two or more scenes', () => {
    timeline.clips = 2;
    const { host, cleanup } = mount(null);
    expect(q(host, 'retarget-scenes-hint')).toBeNull();
    cleanup();
  });
});

