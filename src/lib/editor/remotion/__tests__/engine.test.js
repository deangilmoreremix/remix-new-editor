import { describe, it, expect } from 'vitest';
import { timelineToComposition, QUALITY_PRESETS } from '../timelineToComposition.js';
import { mapVideoTransition } from '../transitionMap.js';
import { entrancePose, exitPose, animationStyle } from '../overlayAnimations.js';
import { exportWarnings } from '../exportWarnings.js';
import { stretchLowerThird, buildLowerThirdLottie, LT_OP } from '../../addons/lowerThirds.js';
import { createAddonClip } from '../../addons/index.js';

const T = 60;
const at = (clip, start, end) => ({ ...clip, left: (start / T) * 100, width: ((end - start) / T) * 100 });
const overlay = (type, start, end, patch = {}) => {
  const c = createAddonClip(type, { startSec: start, timelineSeconds: T, id: `${type}-${start}` });
  delete c.start; delete c.end;
  return at({ ...c, addon: { ...c.addon, ...patch } }, start, end);
};

function sampleState() {
  return {
    timelineSeconds: T,
    tracks: [
      { id: 'v', type: 'video', name: 'Main Video', items: [
        at({ id: 'a', type: 'video', src: 'https://cdn.test/a.mp4', volume: 0.5 }, 0, 10),
        at({ id: 'b', type: 'image', src: 'https://cdn.test/b.jpg', fit: 'contain' }, 10, 20),
        at({ id: 'placeholder', type: 'video' }, 20, 25),
      ] },
      { id: 'au', type: 'audio', name: 'VO', muted: true, items: [at({ id: 'vo', type: 'audio', src: 'https://cdn.test/vo.mp3' }, 0, 20)] },
      { id: 'tx', type: 'text', name: 'Text', items: [
        overlay('overlay-text', 2, 6, { text: 'Hi {{firstName}}' }),
        overlay('overlay-lower-third', 3, 8, { name: '{{firstName}} Lee' }),
        overlay('overlay-video-transition', 9.5, 10.5, { transition: 'wipeLeft' }),
        overlay('addon-pause', 4, 5),
        overlay('lead-form', 12, 15),
        at({ id: 'title', type: 'text', heading: 'Welcome', body: '' }, 20, 22),
      ] },
    ],
  };
}

describe('timelineToComposition', () => {
  const profile = { variables: { firstName: 'Ann' } };
  const m = timelineToComposition(sampleState(), { quality: '720p', profile });

  it('sizes and times the composition', () => {
    expect(QUALITY_PRESETS['4k']).toEqual({ width: 3840, height: 2160 });
    expect([m.width, m.height, m.fps]).toEqual([1280, 720, 30]);
    expect(m.durationInFrames).toBe(1800);
  });

  it('maps media clips in paint order with frames, trims, fit and mute', () => {
    const media = m.layers.filter((l) => l.kind === 'video' || l.kind === 'image');
    expect(media.map((l) => [l.id, l.kind, l.from, l.durationInFrames])).toEqual([['a', 'video', 0, 300], ['b', 'image', 300, 300]]);
    expect(media[0].volume).toBe(0.5);
    expect(media[1].fit).toBe('contain');
    expect(m.layers.some((l) => l.id === 'placeholder')).toBe(false);
    expect(m.audio).toEqual([expect.objectContaining({ id: 'vo', volume: 0 })]); // track muted
  });

  it('includes overlays with resolved tokens and lower-third Lottie data', () => {
    const text = m.layers.find((l) => l.type === 'overlay-text');
    expect(text.options.text).toBe('Hi Ann');
    const lt = m.layers.find((l) => l.type === 'overlay-lower-third');
    expect(lt.options.lottie.layers.some((l) => l.ty === 5 && l.t.d.k[0].s.t === 'Ann Lee')).toBe(true);
    expect(m.fonts).toEqual(expect.arrayContaining(['Anton', 'Montserrat']));
    expect(m.layers.find((l) => l.kind === 'title').heading).toBe('Welcome');
  });

  it('leaves interactive addons out of the pixels (but reports them)', () => {
    expect(m.skipped.map((s) => s.type).sort()).toEqual(['addon-pause', 'lead-form']);
    expect(m.layers.some((l) => l.type === 'addon-pause' || l.type === 'lead-form')).toBe(false);
  });

  it('pairs a video transition with the clips either side of the cut', () => {
    expect(m.transitions).toEqual([expect.objectContaining({ from: 285, durationInFrames: 30, presentation: 'wipe', outgoingId: 'a', incomingId: 'b' })]);
  });
});

describe('transition mapping', () => {
  it('uses Remotion equivalents and CSS fallbacks for GPU ones', () => {
    expect(mapVideoTransition('fade')).toMatchObject({ presentation: 'fade', exact: true, gpu: false });
    expect(mapVideoTransition('wipeUp')).toMatchObject({ presentation: 'wipe', presentationProps: { direction: 'from-bottom' } });
    expect(mapVideoTransition('crosswarp')).toMatchObject({ presentation: 'crosswarp', gpu: true, fallback: 'fade' });
    expect(mapVideoTransition('windowblinds')).toMatchObject({ presentation: 'wipe', exact: false });
    expect(mapVideoTransition('heart')).toMatchObject({ presentation: 'iris' });
    expect(mapVideoTransition('totally-unknown')).toMatchObject({ presentation: 'fade', exact: false });
  });
});

describe('overlay animations', () => {
  it('entrances start hidden/offset and settle; exits mirror', () => {
    expect(entrancePose('fadeIn', 0).opacity).toBe(0);
    expect(entrancePose('fadeIn', 1)).toMatchObject({ opacity: 1, tx: 0, ty: 0 });
    expect(entrancePose('fadeInUp', 0).ty).toBeGreaterThan(0);
    expect(exitPose('fadeOutDown', 1).ty).toBeGreaterThan(0);
    expect(exitPose('fadeOutUp', 1).ty).toBeLessThan(0);
    const mid = animationStyle({ animation: { in: 'zoomIn' } }, 5, 120);
    expect(mid.opacity).toBeLessThan(1);
    expect(mid.transform).toContain('scale(');
    expect(animationStyle({}, 50, 120)).toEqual({ opacity: 1, transform: undefined });
  });
});

describe('lower third stretch', () => {
  it('keeps the in, extends the hold, moves the out to the end', () => {
    const anim = buildLowerThirdLottie({ name: 'A', title: 'B' });
    const s = stretchLowerThird(anim, 150);
    expect(s.op).toBe(150);
    expect(s.layers.every((l) => l.op === 150)).toBe(true);
    const ts = JSON.stringify(s).match(/"t":(\d+)/g).map((x) => Number(x.split(':')[1]));
    expect(Math.max(...ts)).toBe(150);
    expect(stretchLowerThird(anim, 30).op).toBe(LT_OP); // never shorter than the authored animation
  });
});

describe('export warnings', () => {
  it('explains skipped interactivity, transition substitutions and 4K', () => {
    const m = timelineToComposition(sampleState());
    const w = exportWarnings(m, { quality: '4k' });
    expect(w.join(' ')).toMatch(/Interactive elements \(Pause, Lead Generator\)/);
    expect(w.join(' ')).toMatch(/4K renders in your browser/);
    const gl = timelineToComposition({ ...sampleState(), tracks: [{ id: 't', type: 'text', items: [overlay('overlay-video-transition', 1, 2, { transition: 'crosswarp' })] }] });
    expect(exportWarnings(gl).join(' ')).toMatch(/"crosswarp" exports as Fade/);
  });
});
