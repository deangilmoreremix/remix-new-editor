// [remix] SRT round trip with OpenChatCut's srt.ts / exportCaptions.ts on a clip's captions.
import { describe, it, expect } from 'vitest';
import { parseSrt } from '../../openchatcut/captions/srt';
import { captionsToSrt } from '../../openchatcut/captions/exportCaptions';
import { backfillCueIdentities } from '../../openchatcut/transcript/identity';
import type { CaptionsData } from '../../openchatcut/captions/types';

const SRT = '1\n00:00:01,000 --> 00:00:02,500\nHello there\n\n2\n00:00:03,000 --> 00:00:04,000\nSecond line\n';
describe('captions .srt', () => {
  it('imports cues as timed words and exports them back', () => {
    const words = backfillCueIdentities(parseSrt(SRT), 'clip');
    expect(words.length).toBeGreaterThan(0);
    const caps = { enabled: true, template: 'tiktok', pacing: 'phrase', words, offsetFrames: 0 } as unknown as CaptionsData;
    const out = captionsToSrt(caps, [], 30);
    expect(out).toContain('00:00:01,000');
    expect(out).toMatch(/Hello there/);
    expect(out).toMatch(/Second line/);
  });
});
