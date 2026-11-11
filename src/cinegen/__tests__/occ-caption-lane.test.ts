// [remix] Caption lane operations over OpenChatCut's cue model.
import { describe, it, expect } from 'vitest';
import { laneCues, moveCues, trimCue, deleteCues, copyCues, pasteCues, snapMs } from '@cinegen/lib/occ/caption-lane';
import { backfillCueIdentities } from '../../openchatcut/transcript/identity';
import type { Clip } from '@cinegen/types/timeline';

const words = backfillCueIdentities('Hello there and welcome back to the channel today'.split(' ').map((text, i) => ({ text, start: 1000 + i * 400, end: 1000 + i * 400 + 380 })), 'c1');
const clip = { id: 'c1', captions: { enabled: true, template: 'tiktok', pacing: 'phrase', words, offsetFrames: 0 } } as unknown as Clip;

describe('caption lane', () => {
  it('lists the cues the renderer would show', () => {
    const cues = laneCues([clip]);
    expect(cues.length).toBeGreaterThan(1);
    expect(cues[0].start).toBe(1000);
  });
  it('moves a cue (group move shifts every selected cue) without going before zero', () => {
    const cues = laneCues([clip]);
    const moved = moveCues(clip.captions!, [cues[0]], 500);
    expect(laneCues([{ ...clip, captions: moved } as Clip])[0].start).toBe(1500);
    const early = moveCues(clip.captions!, [cues[0]], -5000);
    expect(laneCues([{ ...clip, captions: early } as Clip])[0].start).toBe(0);
  });
  it('trims the end and start of a cue but keeps a minimum length', () => {
    const cue = laneCues([clip])[0];
    const last = cue.idx[cue.idx.length - 1];
    const t1 = trimCue(clip.captions!, cue, 'end', -200);
    expect(t1.words![last].end).toBe(clip.captions!.words![last].end - 200);
    const t2 = trimCue(clip.captions!, cue, 'start', 100000);
    expect(t2.words![cue.idx[0]].start).toBeLessThan(t2.words![cue.idx[1]].start);
  });
  it('deletes (hides) a cue, and copy/paste adds a timed copy with new identities', () => {
    const cues = laneCues([clip]);
    const del = deleteCues(clip.captions!, [cues[0]]);
    expect(laneCues([{ ...clip, captions: del } as Clip]).some((c) => c.text === cues[0].text)).toBe(false);
    const board = copyCues(clip.captions!, [cues[1]]);
    const pasted = pasteCues(clip.captions!, board, 20000, 'c1');
    expect(pasted.words!.length).toBe(clip.captions!.words!.length + cues[1].idx.length);
    const ids = pasted.words!.map((w) => (w as any).id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.max(...pasted.words!.map((w) => w.start))).toBeGreaterThanOrEqual(20000);
  });
  it('snaps to the nearest target inside the threshold', () => {
    expect(snapMs(1990, [1000, 2000, 5000], 50)).toBe(2000);
    expect(snapMs(1800, [1000, 2000], 50)).toBe(1800);
  });
});
