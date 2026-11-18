// [remix] WebVTT export beside SRT: same cues, WEBVTT header, dot milliseconds, escaped text.
import { describe, it, expect } from 'vitest';
import { parseSrt } from '../../openchatcut/captions/srt';
import { captionsToSrt, captionsToVtt, vttTimestamp, srtTimestamp } from '../../openchatcut/captions/exportCaptions';
import { backfillCueIdentities } from '../../openchatcut/transcript/identity';
import type { CaptionsData } from '../../openchatcut/captions/types';

const caps = (srt: string) => ({ enabled: true, template: 'tiktok', pacing: 'phrase', words: backfillCueIdentities(parseSrt(srt), 'clip'), offsetFrames: 0 }) as unknown as CaptionsData;
const SRT = '1\n00:00:01,000 --> 00:00:02,500\nHello there\n\n2\n00:00:03,000 --> 00:00:04,000\nSecond line\n';

describe('captions .vtt', () => {
  it('starts with WEBVTT, uses dot milliseconds, and has the same cues as the SRT', () => {
    const c = caps(SRT);
    const vtt = captionsToVtt(c, [], 30);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toMatch(/\n00:00:01\.000 --> 00:00:0\d\.\d{3}\n/);                 // dot milliseconds
    expect(vtt).not.toContain(',');                                            // no SRT-style comma timecodes
    expect(vtt).toMatch(/Hello there/); expect(vtt).toMatch(/Second line/);
    const cues = (t: string) => t.split(/\n\n+/).filter((b) => /-->/.test(b)).length;
    expect(cues(vtt)).toBe(cues(captionsToSrt(c, [], 30)));
    expect(vtt.endsWith('\n')).toBe(true);
  });

  it('formats timecodes (hours, a dot for milliseconds) and escapes & and < in the text', () => {
    expect(vttTimestamp(3_723_456)).toBe('01:02:03.456');
    expect(srtTimestamp(3_723_456)).toBe('01:02:03,456');
    const words = backfillCueIdentities([{ text: 'Tom', start: 0, end: 300 }, { text: '&', start: 300, end: 500 }, { text: '<b>', start: 500, end: 900 }], 'clip');
    const vtt = captionsToVtt({ enabled: true, template: 'tiktok', pacing: 'phrase', words, offsetFrames: 0 } as unknown as CaptionsData, [], 30);
    expect(vtt).toContain('Tom &amp; &lt;b>');
    expect(vtt).not.toContain('<b>');
  });

  it('no captions give just the header', () => {
    expect(captionsToVtt({ enabled: true, template: 'tiktok', pacing: 'phrase', words: [], offsetFrames: 0 } as unknown as CaptionsData, [], 30)).toBe('WEBVTT\n\n');
  });
});
