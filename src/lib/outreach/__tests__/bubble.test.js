import { describe, it, expect } from 'vitest';
import { buildCampaignProject, defaultDraft, bubbleOf, bubblePip, cardSide } from '../draft.js';
import { multiCamBox } from '../../editor/multiCam.js';
import { timelineToComposition } from '../../editor/remotion/timelineToComposition.js';
import { scrollAt } from '../../editor/remotion/scroll.js';
import { cardKey, cardDetails } from '../profileCard.js';

const ready = (background) => ({
  ...defaultDraft(),
  video: { url: 'https://cdn.x/rec.mp4', duration: 20, hasAudio: true, type: 'camera' },
  voice: { mode: 'stock', stockVoice: 'Wise_Woman', cloneVoiceId: '', consent: null, fallbackUrl: 'https://cdn.x/fb.mp3', fallbackDuration: 1.2 },
  cta: { enabled: false, label: '', url: '' },
  contacts: [{ id: 'c1', firstName: 'Mike', email: 'm@x.co', company: 'Linear', website: 'linear.app' }],
  siteShots: { 'https://linear.app/': 'https://cdn.x/linear.jpg' },
  background: { ...defaultDraft().background, mode: 'website', fallbackSite: 'linear.app', ...background },
});

describe('camera bubble and scrolling (dynamic background settings)', () => {
  it('defaults to a fixed bubble bottom left, like before', () => {
    expect(bubbleOf(defaultDraft())).toEqual({ mode: 'fixed', corner: 'bottom-left' });
    expect(bubbleOf({ background: { bubble: { mode: 'x', corner: 'nowhere' } } })).toEqual({ mode: 'fixed', corner: 'bottom-left' });
  });

  it('a fixed corner and Spotlight reach the published video, and the player draws them there', () => {
    const p = buildCampaignProject(ready({ bubble: { mode: 'fixed', corner: 'top-right' } }), { now: 1 });
    expect(p.multiCam.pip).toEqual({ corner: 'top-right', size: 26, shape: 'circle' });
    expect(multiCamBox(p.multiCam, 'second')).toMatchObject({ left: 71, top: 5.4, width: 26 });
    const spot = buildCampaignProject(ready({ bubble: { mode: 'spotlight' } }), { now: 1 });
    expect(spot.multiCam.pip).toEqual({ corner: 'bottom-center', size: 40, shape: 'circle' });
    expect(multiCamBox(spot.multiCam, 'second')).toMatchObject({ left: 30, width: 40 });
    expect(bubblePip(ready({ bubble: { mode: 'spotlight' } })).size).toBe(40);
  });

  it('scroll the page on or off, and scroll back up', () => {
    const bgItem = (d) => buildCampaignProject(d, { now: 1 }).tracks[0].items[0];
    expect(bgItem(ready({}))).toMatchObject({ scroll: true, cursor: true });
    expect(bgItem(ready({ scroll: false })).scroll).toBeUndefined();
    const back = buildCampaignProject(ready({ scrollBack: true }), { now: 1 });
    expect(back.tracks[0].items[0]).toMatchObject({ scroll: true, scrollBack: true });
    const layer = timelineToComposition(back, { profile: null }).layers.find((l) => l.kind === 'image');
    expect(layer).toMatchObject({ scroll: true, scrollBack: true });
    expect([0, 0.35, 0.7, 0.85, 1].map((p) => Math.round(scrollAt(p, true) * 100) / 100)).toEqual([0, 0.5, 1, 0.5, 0]);
    expect(scrollAt(0.5)).toBe(0.5);
  });

  it('the profile card sits away from the bubble', () => {
    expect(cardSide(ready({ bubble: { mode: 'fixed', corner: 'bottom-left' } }))).toBe('right');
    expect(cardSide(ready({ bubble: { mode: 'fixed', corner: 'top-right' } }))).toBe('left');
    expect(cardSide(ready({ bubble: { mode: 'spotlight' } }))).toBe('top');
    const d = cardDetails({ firstName: 'Mike' });
    expect(cardKey(d)).toBe(cardKey(d, 'right'));
    expect(cardKey(d, 'left')).not.toBe(cardKey(d));
  });
});
