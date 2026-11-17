import { describe, it, expect } from 'vitest';
import { captionLines, setLineText, removeLine, setLineTiming } from '../lines.js';
import { spreadWords } from '../live.js';
import { layoutWords, paintCaptions, captionAnimation } from '../painter.js';
import { ENGINES, detectCapabilities, recommendEngine } from '../engines.js';
import { defaultCaptionStyle } from '../../editor/remotion/captions.js';

const words = (...t) => t.map((text, i) => ({ text: (i ? ' ' : '') + text, startMs: i * 400, endMs: i * 400 + 400, timestampMs: i * 400 + 200, confidence: null }));
const style = { ...defaultCaptionStyle('tiktok'), combineMs: 5000 };

/** Canvas 2D stub that records what is drawn. Text is 10px per character. */
const mockCtx = () => {
  const calls = [];
  const rec = (name) => (...a) => { calls.push([name, ...a]); };
  const ctx = {
    calls, font: '', fillStyle: '', measureText: (t) => ({ width: t.length * 10 }),
    save: rec('save'), restore: rec('restore'), translate: rec('translate'), scale: rec('scale'), clip: rec('clip'), rect: rec('rect'),
    beginPath: rec('beginPath'), fill: rec('fill'), strokeText: rec('strokeText'),
    fillText(t, x, y) { calls.push(['fillText', t, x, y, this.fillStyle]); },
  };
  return ctx;
};

describe('line editing', () => {
  const caps = words('hello', 'brave', 'new', 'world');
  it('groups words into lines the viewer sees', () => {
    const lines = captionLines(caps, style);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ from: 0, to: 4, text: 'hello brave new world' });
  });
  it('keeps word timing when the word count is unchanged', () => {
    const [line] = captionLines(caps, style);
    const out = setLineText(caps, line, 'hullo brave new World');
    expect(out.map((c) => c.text.trim())).toEqual(['hullo', 'brave', 'new', 'World']);
    expect(out.map((c) => c.startMs)).toEqual(caps.map((c) => c.startMs));
    expect(out[0].text.startsWith(' ')).toBe(false);
    expect(out[1].text.startsWith(' ')).toBe(true);
  });
  it('spreads new words across the old span when the count changes', () => {
    const [line] = captionLines(caps, style);
    const out = setLineText(caps, line, 'a b');
    expect(out).toHaveLength(2);
    expect(out[0].startMs).toBe(0);
    expect(out[1].endMs).toBe(1600);
  });
  it('removes a line when its text is cleared', () => {
    const [line] = captionLines(caps, style);
    expect(setLineText(caps, line, '  ')).toEqual([]);
    expect(removeLine(caps, line)).toEqual([]);
  });
  it('retimes a whole line proportionally', () => {
    const [line] = captionLines(caps, style);
    const out = setLineTiming(caps, line, 1000, 2600);
    expect(out[0].startMs).toBe(1000);
    expect(out[3].endMs).toBe(2600);
  });
});

describe('live speech word spreading', () => {
  it('gives every word a slot inside the phrase and no leading space on the first word', () => {
    const out = spreadWords('one three', 1000, 3000, true);
    expect(out.map((c) => c.text)).toEqual(['one', ' three']);
    expect(out[0].startMs).toBe(1000);
    expect(out[1].endMs).toBe(3000);
    expect(out[0].endMs).toBe(out[1].startMs);
  });
  it('returns nothing for empty text', () => expect(spreadWords('  ', 0, 100)).toEqual([]));
});

describe('layout + painting', () => {
  it('wraps words to the max width', () => {
    const toks = words('aaaa', 'bbbb', 'cccc').map((w) => ({ text: w.text }));
    const { lines } = layoutWords(toks, (t) => t.length * 10, 100, false);
    expect(lines.map((l) => l.words.map((w) => w.text))).toEqual([['aaaa', 'bbbb'], ['cccc']]);
  });
  it('draws nothing when no caption is showing', () => {
    const ctx = mockCtx();
    expect(paintCaptions(ctx, 1000, 1000, words('hi'), style, 60000)).toBe(false);
    expect(ctx.calls.some((c) => c[0] === 'fillText')).toBe(false);
  });
  it('draws each word, highlighting the spoken one', () => {
    const ctx = mockCtx();
    const st = { ...style, color: '#ffffff', highlightColor: '#ff0000', uppercase: false };
    expect(paintCaptions(ctx, 1000, 1000, words('hello', 'world'), st, 500)).toBe(true);
    const fills = ctx.calls.filter((c) => c[0] === 'fillText');
    expect(fills.map((f) => f[1])).toEqual(['hello', 'world']);
    expect(fills[0][4]).toBe('#ffffff');
    expect(fills[1][4]).toBe('#ff0000');
  });
  it('places the block by position and keeps it on the frame', () => {
    const y = (position) => { const ctx = mockCtx(); paintCaptions(ctx, 1000, 1000, words('hi'), { ...style, position }, 100); return ctx.calls.find((c) => c[0] === 'translate')[2]; };
    expect(y('top')).toBeLessThan(y('middle'));
    expect(y('middle')).toBeLessThan(y('bottom'));
    expect(y('bottom')).toBeLessThan(1000);
  });
  it('wipes karaoke words with a clip', () => {
    const ctx = mockCtx();
    paintCaptions(ctx, 1000, 1000, words('sing', 'along'), { ...style, preset: 'karaoke', karaoke: true }, 600);
    expect(ctx.calls.some((c) => c[0] === 'clip')).toBe(true);
  });
  it('maps Capite looks to their motion', () => {
    expect(captionAnimation({ preset: 'capite-bounce' })).toBe('bounce');
    expect(captionAnimation({ preset: 'capite-crimson-pop' })).toBe('box');
    expect(captionAnimation({ preset: 'tiktok' })).toBe('highlight');
    expect(captionAnimation({ preset: 'karaoke' })).toBe('karaoke');
  });
});

describe('engines', () => {
  it('lists only free on-device engines', () => {
    expect(ENGINES.map((e) => e.id)).toEqual(['whisper-webgpu', 'whisper-wasm', 'webspeech']);
  });
  it('detects capabilities without throwing outside a browser', async () => {
    const caps = await detectCapabilities();
    expect(caps).toHaveProperty('webgpu');
    expect(recommendEngine({ webgpu: false })).toBe('whisper-wasm');
    expect(recommendEngine({ webgpu: true })).toBe('whisper-webgpu');
  });
});

// ---- the portable core must not drift from the copies it was made from, and must not import from the host app
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as core from '../model.js';
import * as timeline from '../../editor/remotion/captions.js';
import { CAPITE_CAPTION_STYLES } from '../styles.js';
import { CAPITE_CAPTION_STYLES as shared } from '../../../features/personalization/shared/personalization/captions/capiteStyles';

describe('portable core', () => {
  it('has the same Capite looks as the shared personalization data', () => {
    expect(CAPITE_CAPTION_STYLES).toEqual(shared);
  });
  it('builds the same style presets and caption pages as the Timeline editor', () => {
    expect(Object.keys(core.CAPITE_PRESETS)).toEqual(Object.keys(timeline.CAPITE_PRESETS));
    ['tiktok', 'classic', 'box', 'karaoke', 'minimal', ...Object.keys(core.CAPITE_PRESETS)].forEach((k) => expect(core.defaultCaptionStyle(k)).toEqual(timeline.defaultCaptionStyle(k)));
    const caps = words('one', 'two', 'three', 'four', 'five', 'six');
    expect(core.captionPages(caps, { combineMs: 900 })).toEqual(timeline.captionPages(caps, { combineMs: 900 }));
    expect(core.captionsToSrt(caps)).toBe(timeline.captionsToSrt(caps));
  });
  it('imports only npm packages and its own files, so the folder can be copied between repos', () => {
    const dir = join(__dirname, '..');
    readdirSync(dir).filter((f) => f.endsWith('.js')).forEach((f) => {
      const specs = [...readFileSync(join(dir, f), 'utf8').matchAll(/(?:^|\n)\s*import[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|new URL\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1] || m[2] || m[3]);
      specs.forEach((s) => expect(s.startsWith('./') || ['@remotion/captions', '@huggingface/transformers', 'mediabunny'].includes(s), `${f} imports ${s}`).toBe(true));
    });
  });
});

// ---- features added from the Capite / ai-video-captions comparison
import { nudgeLine, findReplace, changeCase, captionsToPlain } from '../lines.js';
import { captionsToTxt, captionsToAss, assColor } from '../exports.js';
import { CAPTION_LANGUAGES } from '../engines.js';
import { scriptFontsFor, captionFont } from '../painter.js';

describe('transcript tools', () => {
  const caps = words('hello', 'brave', 'new', 'world');
  it('nudges a line by 100 ms without going negative', () => {
    const [line] = captionLines(caps, style);
    const out = nudgeLine(caps, line, 100);
    expect(out[0].startMs).toBe(100);
    expect(nudgeLine(caps, line, -5000)[0].startMs).toBe(0);
  });
  it('finds and replaces, including a phrase that spans two words', () => {
    const r = findReplace(caps, 'brave new', 'bold');
    expect(r.count).toBe(1);
    expect(captionsToPlain(r.captions)).toBe('hello bold world');
    expect(findReplace(caps, 'HELLO', 'bye', { matchCase: true }).count).toBe(0);
    expect(findReplace(caps, 'HELLO', 'bye').count).toBe(1);
    expect(findReplace(caps, '', 'x').count).toBe(0);
    expect(findReplace(caps, '(', 'x').count).toBe(0); // regex characters are literal
  });
  it('changes case and keeps timing and spacing', () => {
    const up = changeCase(caps, 'upper');
    expect(up.map((c) => c.text)).toEqual(['HELLO', ' BRAVE', ' NEW', ' WORLD']);
    expect(changeCase(caps, 'title').map((c) => c.text.trim())).toEqual(['Hello', 'Brave', 'New', 'World']);
    expect(changeCase(up, 'lower')[1].text).toBe(' brave');
    expect(up.map((c) => c.startMs)).toEqual(caps.map((c) => c.startMs));
  });
});

describe('file exports', () => {
  const caps = words('hello', 'brave', 'new', 'world');
  it('writes a plain transcript', () => expect(captionsToTxt(caps, { combineMs: 5000 })).toBe('hello brave new world\n'));
  it('writes ASS with a style, karaoke word timing and a position', () => {
    const ass = captionsToAss(caps, { ...style, fontFamily: 'Montserrat', uppercase: true, color: '#ffffff', highlightColor: '#ff0000', position: 'bottom', stroke: true }, { width: 1080, height: 1920 });
    expect(ass).toContain('PlayResX: 1080');
    expect(ass).toContain('Style: Default,Montserrat,');
    expect(ass).toContain('&H000000FF'); // red highlight, ASS is BGR
    expect(ass).toMatch(/Dialogue: 0,0:00:00\.00,0:00:01\.\d\d,Default,,0,0,0,,\{\\an8\\pos\(540,\d+\)\}\{\\k40\}HELLO\{\\k40\} BRAVE/);
    expect(ass.split('\n').filter((l) => l.startsWith('Dialogue')).length).toBe(1);
  });
  it('converts colours to ASS order and alpha', () => {
    expect(assColor('#ff8000')).toBe('&H000080FF');
    expect(assColor('rgba(0,0,0,0.6)')).toBe('&H66000000');
  });
});

describe('languages, free position, script fonts', () => {
  it('offers every Whisper language, English first after auto-detect', () => {
    expect(CAPTION_LANGUAGES).toHaveLength(100);
    expect(CAPTION_LANGUAGES[0][0]).toBe('auto');
    expect(CAPTION_LANGUAGES[1][0]).toBe('en');
    expect(new Set(CAPTION_LANGUAGES.map((l) => l[0])).size).toBe(100);
  });
  it('honours a dragged vertical position over the named position', () => {
    const y = (st) => { const ctx = mockCtx(); paintCaptions(ctx, 1000, 1000, words('hi'), st, 100); return ctx.calls.find((c) => c[0] === 'translate')[2]; };
    expect(y({ ...style, position: 'bottom', positionY: 0.3 })).toBeCloseTo(300, -1);
    expect(y({ ...style, positionY: 2 })).toBeLessThan(1000); // clamped on the frame
  });
  it('picks fallback fonts for the script of the text', () => {
    expect(scriptFontsFor('hello')).toEqual([]);
    expect(scriptFontsFor('こんにちは')).toEqual(['Noto Sans JP']);
    expect(scriptFontsFor('مرحبا')).toEqual(['Noto Sans Arabic']);
    expect(scriptFontsFor('नमस्ते')).toEqual(['Noto Sans Devanagari']);
    expect(captionFont({ fontFamily: 'Inter' }, 40)).toContain('"Noto Sans SC"');
  });
});
