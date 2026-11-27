import { describe, it, expect, vi } from 'vitest';
import { normalizeCuts, keptRanges, buildSegments, segmentsDuration, isUnchanged, segmentFrames, renderSegments } from '../videoEdit.jsx';
import { transcriptLines, cleanTranscript, transcriptText, transcriptSrt, lineAt } from '../transcript.js';
import { preparePublishProject } from '../../editor/publish/publishClient.js';

const main = { src: 'https://cdn/rec.mp4', duration: 30 };

describe('outreach video editor', () => {
  it('merges overlapping cuts and keeps them inside the video', () => {
    expect(normalizeCuts([[10, 12], [11, 14], [40, 50], [5, 3]], 30)).toEqual([[3, 5], [10, 14]]);
  });

  it('keeps the trimmed range minus the cuts', () => {
    expect(keptRanges({ duration: 30, trimStart: 2, trimEnd: 28, cuts: [[10, 14]] })).toEqual([{ from: 2, to: 10 }, { from: 14, to: 28 }]);
    expect(keptRanges({ duration: 30, trimStart: 0, cuts: [[0, 5], [25, 40]] })).toEqual([{ from: 5, to: 25 }]);
    expect(keptRanges({ duration: 30, trimStart: 10, trimEnd: 10.1 })).toEqual([]);
  });

  it('combines a clip before and after, in order; untouched is detected', () => {
    const segs = buildSegments({ main, edits: { trimStart: 1 }, before: { src: 'blob:intro', duration: 4 }, after: { src: 'blob:demo', duration: 60 } });
    expect(segs.map((s) => s.src)).toEqual(['blob:intro', main.src, 'blob:demo']);
    expect(segmentsDuration(segs)).toBe(4 + 29 + 60);
    expect(isUnchanged(buildSegments({ main }), main)).toBe(true);
    expect(isUnchanged(segs, main)).toBe(false);
  });

  it('turns segments into frames for <Series> and renders them', async () => {
    const f = segmentFrames([{ src: 'a', from: 1, to: 2.5 }]);
    expect(f[0]).toMatchObject({ trimBefore: 30, trimAfter: 75, durationInFrames: 45 });
    const renderMediaOnWeb = vi.fn(async () => ({ getBlob: async () => new Blob(['x']) }));
    const out = await renderSegments([{ src: 'a', from: 0, to: 2 }], { renderer: { canRenderMediaOnWeb: async ({ container }) => ({ canRender: container === 'mp4' }), renderMediaOnWeb } });
    expect(renderMediaOnWeb.mock.calls[0][0]).toMatchObject({ container: 'mp4', composition: { durationInFrames: 60, width: 1920 } });
    expect(out).toMatchObject({ mimeType: 'video/mp4', duration: 2 });
    await expect(renderSegments([], { renderer: {} })).rejects.toThrow(/Nothing is left/);
  });
});

describe('outreach transcript', () => {
  const words = 'Hi there. This is a quick video about your team and how we can help you book more calls'.split(' ')
    .map((w, i) => ({ text: (i ? ' ' : '') + w, startMs: i * 300, endMs: i * 300 + 250 }));

  it('groups words into sentence lines', () => {
    const lines = transcriptLines(words);
    expect(lines[0]).toEqual({ startMs: 0, endMs: 550, text: 'Hi there.' });
    expect(lines[1].text.split(' ')).toHaveLength(12);
    expect(lines.at(-1).text.endsWith('calls')).toBe(true);
  });

  it('is cleaned and capped for publishing, and published with the campaign', () => {
    const t = cleanTranscript({ lang: 'en', lines: [{ startMs: 0, endMs: 900, text: '  Hi <b>there</b>  ' }, { text: '' }], translations: { es: [{ startMs: 0, endMs: 900, text: 'Hola' }], 'bad code': [] } });
    expect(t).toEqual({ lang: 'en', lines: [{ startMs: 0, endMs: 900, text: 'Hi <b>there</b>' }], translations: { es: [{ startMs: 0, endMs: 900, text: 'Hola' }] } });
    expect(cleanTranscript({ lines: [] })).toBeNull();
    const project = preparePublishProject({ tracks: [], transcript: t }, { title: 'x' });
    expect(project.transcript.lines[0].text).toBe('Hi <b>there</b>');
  });

  it('downloads as text or SRT, and finds the line being spoken', () => {
    const lines = [{ startMs: 0, endMs: 1000, text: 'One.' }, { startMs: 65000, endMs: 66000, text: 'Two.' }];
    expect(transcriptText(lines)).toBe('[0:00] One.\n[1:05] Two.\n');
    expect(transcriptSrt(lines)).toContain('00:01:05,000 --> 00:01:06,000');
    expect(lineAt(lines, 500)).toBe(0);
    expect(lineAt(lines, 30000)).toBe(-1);
    expect(lineAt(lines, 65500)).toBe(1);
  });
});
