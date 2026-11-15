import { describe, it, expect, vi, beforeEach } from 'vitest';

const openPersonalization = vi.fn();
vi.mock('../../features/personalization/mount.jsx', () => ({ openPersonalization: (o) => openPersonalization(o) }));

import { VideoPersonalizationHub } from './VideoPersonalizationHub.jsx';
import { BaseModal } from './BaseModal.jsx';

beforeEach(() => openPersonalization.mockReset());

describe('VideoPersonalizationHub (opens the real Personalize window)', () => {
  it('keeps the modal API callers rely on', () => {
    const hub = new VideoPersonalizationHub();
    expect(hub).toBeInstanceOf(BaseModal);
    ['renderBody', 'open', 'close'].forEach((m) => expect(typeof hub[m]).toBe('function'));
  });
  it('opens the Personalize window for the timeline, with no dialog of its own', async () => {
    await new VideoPersonalizationHub({ onComplete: () => {} }).open();
    expect(openPersonalization).toHaveBeenCalledTimes(1);
    expect(openPersonalization.mock.calls[0][0]).toMatchObject({ studioId: 'timeline', studioName: 'Timeline Editor', appId: 'ai-video-agent' });
    expect(document.querySelector('.modal-overlay, [role="dialog"]')).toBeNull();
  });
  it('forwards the completion to onComplete, and a throwing handler to onError', async () => {
    const onComplete = vi.fn();
    await new VideoPersonalizationHub({ onComplete }).open();
    openPersonalization.mock.calls[0][0].onComplete({ outputs: { videos: ['a'] } });
    expect(onComplete).toHaveBeenCalledWith({ outputs: { videos: ['a'] } });

    openPersonalization.mockClear();
    const onError = vi.fn();
    await new VideoPersonalizationHub({ onComplete: () => { throw new Error('boom'); }, onError }).open();
    openPersonalization.mock.calls[0][0].onComplete({});
    expect(onError).toHaveBeenCalledTimes(1);
  });
  it('lets a caller pass extra open options (e.g. start on templates)', async () => {
    await new VideoPersonalizationHub({ openOptions: { openTo: 'templates' } }).open();
    expect(openPersonalization.mock.calls[0][0].openTo).toBe('templates');
  });
});
