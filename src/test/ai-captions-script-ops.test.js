import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { segmentWords, flattenSegments, nudgeSegment, editWord, splitSegment, mergeSegments, deleteSegment, addSegment, replaceAll, countMatches, convertCase, segmentsToSrt, segmentsToVtt, segmentsToTxt, lineLabel, segmentText } from '../components/modals/ai-captions/scriptOps.js';
import { phonePreviewHTML, presetFor, clampPos, positionStyle, screenBackground, FALLBACK_FRAME } from '../components/modals/ai-captions/phonePreview.js';
import { saveJob, listJobs, getJob, deleteJob, clearJobs, MAX_JOBS } from '../components/modals/ai-captions/history.js';
import { drawCaption, layoutLines } from '../components/modals/ai-captions/burnIn.js';
import { guessLanguage, languageLabel } from '../components/modals/ai-captions/language.js';
import { captionStyleFor } from '../openchatcut/captions/styles';

const W = (text, start, end) => ({ text, start, end });
const words = [W('this', 0, 300), W('is', 300, 500), W('Muneeb.', 500, 900), W('So', 1900, 2100), W('Edvay', 2100, 2500), W('is', 2500, 2700), W('a', 2700, 2800), W('platform', 2800, 3300)];

describe('AI Captions — Script & Words operations', () => {
  it('breaks the words into lines at sentence ends and pauses', () => {
    const segs = segmentWords(words);
    expect(segs.map(segmentText)).toEqual(['this is Muneeb.', 'So Edvay is a platform']);
    expect(flattenSegments(segs)).toHaveLength(8);
    expect(segmentWords(words, { maxWords: 2 }).length).toBeGreaterThan(3);
  });

  it('nudges a line by 0.1 s without crossing its neighbour or going below zero', () => {
    const segs = segmentWords(words);
    const later = nudgeSegment(segs, 0, 100);
    expect(later[0].words[0].start).toBe(100);
    expect(nudgeSegment(segs, 0, -100)).toBe(segs);                    // already at 0
    const far = nudgeSegment(segs, 0, 5000);
    expect(far[0].words.at(-1).end).toBeLessThanOrEqual(far[1].words[0].start);
    expect(segs[0].words[0].start).toBe(0);                            // original untouched
  });

  it('fixes a word, and removes it when emptied (and the line with it)', () => {
    const segs = segmentWords(words);
    expect(segmentText(editWord(segs, 0, 2, 'Muneeb!')[0])).toBe('this is Muneeb!');
    expect(segmentText(editWord(segs, 0, 0, '')[0])).toBe('is Muneeb.');
    expect(editWord(segmentWords([W('hi', 0, 200)]), 0, 0, '')).toEqual([]);
  });

  it('splits, merges, deletes and adds lines', () => {
    const segs = segmentWords(words);
    const split = splitSegment(segs, 1, 2);
    expect(split.map(segmentText)).toEqual(['this is Muneeb.', 'So Edvay', 'is a platform']);
    expect(splitSegment(segs, 0, 0)).toBe(segs);
    expect(mergeSegments(split, 1).map(segmentText)).toEqual(['this is Muneeb.', 'So Edvay is a platform']);
    expect(mergeSegments(segs, 1)).toBe(segs);                          // last line has no next
    expect(deleteSegment(segs, 0)).toHaveLength(1);
    const added = addSegment(segs, 'brand new', { after: 0 });
    expect(added).toHaveLength(3);
    expect(added[1].words[0].start).toBe(900);
    expect(added[1].words.at(-1).end).toBeLessThanOrEqual(added[2].words[0].start);
  });

  it('finds and replaces, counts matches and converts casing', () => {
    const segs = segmentWords(words);
    expect(countMatches(segs, 'IS')).toBe(3);                          // this, is, is
    expect(countMatches(segs, 'IS', { matchCase: true })).toBe(0);
    expect(countMatches(segs, '')).toBe(0);
    expect(segmentText(replaceAll(segs, 'edvay', 'Edvay!')[1])).toBe('So Edvay! is a platform');
    expect(replaceAll(segmentWords([W('um', 0, 200)]), 'um', '')).toEqual([]);
    expect(replaceAll(segs, 'a.b', 'x')).toHaveLength(2);               // regex characters are literal
    expect(segmentText(convertCase(segs, 'upper')[0])).toBe('THIS IS MUNEEB.');
    expect(segmentText(convertCase(segs, 'title')[1])).toBe('So Edvay Is A Platform');
    expect(segmentText(convertCase(segs, 'lower')[1])).toBe('so edvay is a platform');
  });

  it('exports SRT, VTT and TXT, one cue per line', () => {
    const segs = segmentWords(words);
    expect(segmentsToSrt(segs)).toBe('1\n00:00:00,000 --> 00:00:00,900\nthis is Muneeb.\n\n2\n00:00:01,900 --> 00:00:03,300\nSo Edvay is a platform\n');
    const vtt = segmentsToVtt([{ id: 'x', words: [W('a<b', 0, 100), W('&c', 100, 300)] }]);
    expect(vtt.startsWith('WEBVTT\n\n1\n00:00:00.000 --> 00:00:00.300')).toBe(true);
    expect(vtt).toContain('a&lt;b &amp;c');
    expect(segmentsToTxt(segs)).toBe('this is Muneeb.\nSo Edvay is a platform\n');
    expect(segmentsToSrt([])).toBe('');
    expect(lineLabel(segs[0])).toBe('00:00.00 - 00:00.90');
  });
});

describe('AI Captions — phone preview and position', () => {
  it('draws the sample in the chosen look and place', () => {
    const html = phonePreviewHTML(captionStyleFor('capite-hormozi'), { percent: 30 });
    expect(html).toContain('SAMPLE TEXT'.split(' ')[0]);
    expect(html).toContain('bottom:30%');
    expect(html).toContain('Drag to reposition');
  });
  it('maps the slider to Top / Middle / Bottom and keeps it in 5–90 %', () => {
    expect(presetFor(8)).toBe('bottom'); expect(presetFor(50)).toBe('middle'); expect(presetFor(88)).toBe('top');
    expect(clampPos(0)).toBe(5); expect(clampPos(500)).toBe(90); expect(clampPos('x')).toBe(8);
    expect(positionStyle(120)).toBe('bottom:90%');
  });
});

describe('AI Captions — previews use real pictures', () => {
  it('shows the real frame of the picked video, else the bundled photo, never a made-up placeholder', () => {
    expect(screenBackground('frame', 'data:image/jpeg;base64,AAA')).toContain('data:image/jpeg;base64,AAA');
    expect(screenBackground('frame', '')).toContain(FALLBACK_FRAME);
    expect(screenBackground(undefined, '')).toContain(FALLBACK_FRAME);
    expect(screenBackground('light', 'x')).toContain('linear-gradient');
    expect(screenBackground('frame', 'a"b')).not.toContain('"');
    const html = phonePreviewHTML(captionStyleFor('capite-hormozi'), { frame: 'data:image/jpeg;base64,BBB' });
    expect(html).toContain('data:image/jpeg;base64,BBB');
    expect(phonePreviewHTML(captionStyleFor('capite-hormozi'))).toContain(FALLBACK_FRAME);
  });
});

describe('AI Captions — history (this browser only)', () => {
  beforeAll(() => { vi.stubGlobal('indexedDB', undefined); });   // the in-memory list (jsdom has no IndexedDB)
  afterAll(() => { vi.unstubAllGlobals(); });
  it('saves, lists newest first, reads, deletes and clears; keeps at most MAX_JOBS', async () => {
    await clearJobs();
    const a = await saveJob({ title: 'a.mp4', createdAt: 1, segments: [] });
    const b = await saveJob({ title: 'b.mp4', createdAt: 2, segments: [] });
    expect((await listJobs()).map((j) => j.title)).toEqual(['b.mp4', 'a.mp4']);
    expect((await getJob(a.id)).title).toBe('a.mp4');
    await deleteJob(a.id);
    expect(await getJob(a.id)).toBeUndefined();
    for (let i = 0; i < MAX_JOBS + 3; i += 1) await saveJob({ title: `j${i}`, createdAt: 10 + i, segments: [] });
    expect((await listJobs()).length).toBe(MAX_JOBS);
    expect(b.id).toBeTruthy();
    await clearJobs();
    expect(await listJobs()).toEqual([]);
  });
  it('drops a source clip that is too big to keep', async () => {
    await clearJobs();
    const rec = await saveJob({ title: 'big', video: { size: 200 * 1024 * 1024 }, segments: [] });
    expect(rec.video).toBeUndefined();
    await clearJobs();
  });
});

describe('AI Captions — burn-in drawing', () => {
  const ctx = () => {
    const calls = [];
    const c = new Proxy({ calls, measureText: (t) => ({ width: t.length * 10 }), save() {}, restore() {}, beginPath() {}, rect() {}, fill() { calls.push('fill'); }, strokeText() { calls.push('stroke'); }, fillText(t) { calls.push(`text:${t}`); } }, { set: (o, k, v) => { o[k] = v; return true; }, get: (o, k) => o[k] });
    return c;
  };
  it('wraps words into lines no wider than the frame allows', () => {
    const lines = layoutLines(ctx(), [W('aaaa', 0, 1), W('bbbb', 1, 2), W('cccc', 2, 3)], {}, 100, 4);
    expect(lines.map((l) => l.words.length)).toEqual([2, 1]);
  });
  it('draws the page showing at that time, and nothing outside it', () => {
    const style = captionStyleFor('capite-hormozi');
    const pages = [{ words: [W('hello', 0, 400), W('world', 400, 800)], start: 0, end: 800 }];
    const c = ctx();
    expect(drawCaption(c, 1080, 1920, { style, pages, ms: 100, percent: 8 })).toBe(true);
    expect(c.calls.filter((x) => x.startsWith('text:')).map((x) => x.slice(5))).toEqual(['HELLO', 'WORLD']);
    expect(drawCaption(c, 1080, 1920, { style, pages, ms: 5000, percent: 8 })).toBe(false);
  });
});

describe('AI Captions — language shown when Detect was chosen', () => {
  it('reads the language from the text', () => {
    expect(guessLanguage('Welcome to the dental office, book your cleaning today and smile with confidence')).toBe('en');
    expect(guessLanguage('Bienvenidos a la clínica, reserve su limpieza para sonreír con confianza en el día')).toBe('es');
    expect(guessLanguage('Bienvenue dans notre cabinet, réservez votre nettoyage pour les dents et le sourire')).toBe('fr');
    expect(guessLanguage('Willkommen in der Praxis, buchen Sie Ihre Reinigung und lächeln Sie mit uns')).toBe('de');
    expect(guessLanguage('ようこそ歯科医院へ。今日クリーニングを予約してください')).toBe('ja');
    expect(guessLanguage('Добро пожаловать в нашу клинику, запишитесь на чистку')).toBe('ru');
    expect(guessLanguage('hi')).toBe('');
  });
  it('labels the job', () => {
    expect(languageLabel('es', 'whatever')).toBe('es');
    expect(languageLabel('auto', 'Welcome to the dental office, book your cleaning today and smile')).toBe('auto · en');
    expect(languageLabel('auto', '')).toBe('auto');
  });
});

describe('AI Captions — clips longer than one run', () => {
  it('transcribes in 180 s pieces and joins the words at their real times', async () => {
    // the real transcribeCaptions is used: drive it with a worker that answers each piece
    const calls = [];
    const workerFactory = () => {
      const l = {};
      return { addEventListener: (t, f) => { l[t] = f; }, removeEventListener() {}, terminate() {}, postMessage: () => setTimeout(() => l.message({ data: { type: 'done', words: [{ text: 'hi', startInSeconds: 1, endInSeconds: 1.4 }] } }), 0) };
    };
    vi.doMock('../lib/editor/remotion/transcribe.js', () => ({ decodeAudio: async (_s, o) => { calls.push([o.fromSec, o.toSec]); return new Float32Array(16000); }, transcribeInBrowser: async () => ({ captions: [] }) }));
    vi.resetModules();
    const { transcribeLong: tl } = await import('../components/modals/template-generator/captions.js');
    const out = await tl('blob:x', { durationSec: 400, workerFactory, model: 'base', language: 'en' });
    expect(calls).toEqual([[0, 180], [180, 360], [360, 400]]);
    expect(out.words.map((w) => w.start)).toEqual([1000, 181000, 361000]);
    expect(out.chunks).toBe(3);
    vi.doUnmock('../lib/editor/remotion/transcribe.js');
  });
});
