import { describe, it, expect, beforeEach } from 'vitest';
import { AddonRuntime, createAddonClip, getAddon, addonOptions, INTERACTIVE_ADDONS } from '../index.js';

const T = 60;
const clip = (type, start, end, addon, extra = {}) => ({
  id: `${type}-${start}`,
  type,
  left: (start / T) * 100,
  width: ((end - start) / T) * 100,
  ...(addon ? { addon } : {}),
  ...extra,
});

// Drive the runtime like the page does: advance by `step` seconds, apply
// seeks/pauses, and record what happened.
function play(runtime, clips, { from = 0, to = T, step = 0.36, maxTicks = 2000, listBuilder = null } = {}) {
  let t = from;
  const log = [];
  for (let i = 0; i < maxTicks && t < to; i++) {
    const prev = t;
    t = Math.min(to, t + step);
    const actions = runtime.tick(prev, t, { clips, timelineSeconds: T, listBuilder });
    let paused = false;
    for (const a of actions) {
      log.push(a);
      if (a.type === 'seek') t = a.time;
      if (a.type === 'pause') paused = true;
    }
    if (paused) return { t, log, paused: true };
  }
  return { t, log, paused: false };
}

describe('addon registry', () => {
  it('registers upstream Video Controls and Lead Generation entries in upstream order', () => {
    expect(INTERACTIVE_ADDONS.map((a) => a.label)).toEqual(['Skip', 'Pause', 'Loop', 'Lead Generator', 'CTA']);
    expect(getAddon('addon-skip').section).toBe('Video Controls');
    expect(getAddon('lead-form').section).toBe('Lead Generation');
    expect(getAddon('addon-pause').iconSrc).toBe('/static/images/toolbar/pause.svg');
  });

  it('uses upstream defaults (pause duration 0 = forever, loop 0 = forever)', () => {
    expect(getAddon('addon-pause').defaults().duration).toBe(0);
    expect(getAddon('addon-loop').defaults().loop).toBe(0);
    expect(getAddon('addon-pause').summary({ duration: 0 })).toBe('Pause forever');
    expect(getAddon('addon-loop').summary({ loop: 3 })).toBe('Loop: 3');
  });

  it('creates clips at the playhead, nesting schema options under clip.addon', () => {
    const c = createAddonClip('addon-loop', { startSec: 10, timelineSeconds: T, id: 1 });
    expect(c).toMatchObject({ id: 1, type: 'addon-loop', start: 10, end: 14, addon: { loop: 0 } });
    const lead = createAddonClip('lead-form', { startSec: 58, timelineSeconds: T, id: 2 });
    expect(lead.start).toBe(55); // clamped so the clip fits
    expect(lead.fields).toEqual([{ id: 'email', type: 'email', label: 'Email' }]); // upstream default: one Email field
    expect(lead.ctaText).toBe('Play');
    expect(lead.addon).toBeUndefined();
  });

  it('fills missing options from defaults', () => {
    expect(addonOptions({ type: 'addon-pause', addon: { duration: 5 } })).toEqual({ duration: 5, continueText: 'Click to continue' });
  });
});

describe('AddonRuntime', () => {
  let rt;
  beforeEach(() => { rt = new AddonRuntime(); });

  it('skip jumps from start to end', () => {
    const { log } = play(rt, [clip('addon-skip', 5, 12)], { to: 20 });
    const seek = log.find((a) => a.type === 'seek');
    expect(seek.time).toBeCloseTo(12);
  });

  it('skip reads its end time live (upstream captured it once at setup)', () => {
    const skip = clip('addon-skip', 5, 12);
    play(rt, [skip], { to: 3 });
    skip.width = ((20 - 5) / T) * 100; // user trims the clip while playing
    const { log } = play(rt, [skip], { from: 3, to: 25 });
    expect(log.find((a) => a.type === 'seek').time).toBeCloseTo(20);
  });

  it('loop repeats N times then continues', () => {
    const { log, t } = play(rt, [clip('addon-loop', 2, 4, { loop: 2 })], { to: 10 });
    expect(log.filter((a) => a.type === 'seek' && a.time === 2)).toHaveLength(2);
    expect(t).toBe(10);
  });

  it('loop 0 loops forever', () => {
    const { log } = play(rt, [clip('addon-loop', 2, 4, { loop: 0 })], { to: 10, maxTicks: 300 });
    expect(log.filter((a) => a.type === 'seek').length).toBeGreaterThan(20);
  });

  it('pause with duration 0 pauses forever and asks for a click', () => {
    const { paused, t, log } = play(rt, [clip('addon-pause', 6, 7, { duration: 0 })]);
    expect(paused).toBe(true);
    expect(t).toBe(6);
    expect(log.find((a) => a.type === 'pause').resumeAfter).toBeUndefined();
    expect(log.find((a) => a.type === 'show').overlay).toBe('pause-continue');
  });

  it('pause with a duration auto-resumes and fires once per pass', () => {
    const clips = [clip('addon-pause', 6, 7, { duration: 3 })];
    const first = play(rt, clips);
    expect(first.log.find((a) => a.type === 'pause').resumeAfter).toBe(3);
    expect(first.log.some((a) => a.type === 'show')).toBe(false);
    const resumed = play(rt, clips, { from: first.t });
    expect(resumed.paused).toBe(false);
  });

  it('pauses inside a loop fire on every pass', () => {
    const clips = [clip('addon-loop', 2, 5, { loop: 1 }), clip('addon-pause', 3, 4, { duration: 1 })];
    let t = 0;
    let pauses = 0;
    for (let i = 0; i < 5; i++) {
      const r = play(rt, clips, { from: t, to: 8 });
      pauses += r.log.filter((a) => a.type === 'pause').length;
      t = r.t;
      if (!r.paused) break;
    }
    expect(pauses).toBe(2);
  });

  it('lead form gates at its start until submitted', () => {
    const lead = clip('lead-form', 8, 12);
    const first = play(rt, [lead]);
    expect(first.paused).toBe(true);
    expect(first.log.find((a) => a.type === 'show').overlay).toBe('lead-form');
    rt.markSubmitted(lead.id);
    lead._submitted = true;
    const second = play(rt, [lead], { from: first.t });
    expect(second.paused).toBe(false);
  });

  it('a scrub back before a fired pause re-arms it', () => {
    const clips = [clip('addon-pause', 6, 7, { duration: 2 })];
    play(rt, clips, { to: 10 });
    const again = play(rt, clips, { from: 1, to: 10 }); // jump back = user seek
    expect(again.paused).toBe(true);
  });

  it('List Builder gates playback at the start of the video, once', () => {
    const lb = { enabled: true, kind: 'list-builder' };
    const first = rt.tick(0, 0, { clips: [], timelineSeconds: T, listBuilder: lb });
    expect(first.map((a) => a.type)).toEqual(['seek', 'pause', 'show']);
    expect(first[2].overlay).toBe('list-builder');
    expect(rt.tick(0, 0.36, { clips: [], timelineSeconds: T, listBuilder: lb })).toEqual([]);
  });

  it('a submitted or disabled List Builder does not gate', () => {
    expect(rt.tick(0, 0.3, { listBuilder: { enabled: false } })).toEqual([]);
    expect(new AddonRuntime().tick(0, 0.3, { listBuilder: { enabled: true, _submitted: true } })).toEqual([]);
  });
});
