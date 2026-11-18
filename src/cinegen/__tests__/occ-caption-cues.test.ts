// [remix] OpenChatCut's caption sentence editor model (captions/captionCues.ts) on a CineGen clip's captions.
import { describe, it, expect } from 'vitest';
import { buildCues, cueTextPatch } from '../../openchatcut/captions/captionCues';
import { backfillCueIdentities } from '../../openchatcut/transcript/identity';
import type { CaptionsData } from '../../openchatcut/captions/types';

const words = 'Hello there and welcome back to the channel today'.split(' ').map((text, i) => ({ text, start: i * 400, end: i * 400 + 380 }));
const captions = { enabled: true, template: 'tiktok', pacing: 'phrase', words: backfillCueIdentities(words, 'clip-1'), offsetFrames: 0 } as unknown as CaptionsData;

describe('caption sentence editor', () => {
  it('lists the sentences the renderer would page', () => {
    const rows = buildCues(captions, [], 30);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.text).join(' ')).toContain('Hello');
  });
  it('writes an edit back as word overrides', () => {
    const rows = buildCues(captions, [], 30);
    const patch = cueTextPatch(captions, rows, 0, 'Edited line');
    expect(patch?.wordOverrides).toBeTruthy();
    const next = { ...captions, ...patch } as CaptionsData;
    expect(buildCues(next, [], 30)[0].text).toBe('Edited line');
  });
  it('clearing a sentence hides it', () => {
    const rows = buildCues(captions, [], 30);
    const next = { ...captions, ...cueTextPatch(captions, rows, 0, '') } as CaptionsData;
    expect(buildCues(next, [], 30).some((r) => r.text.includes('Hello'))).toBe(false);
  });
});
