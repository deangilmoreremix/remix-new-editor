// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isKnownPage } from '../../../lib/router.js';
import { search, isWalkthroughQuestion, SYSTEM_PROMPT } from '../../../../netlify/functions/_shared/askSearch.js';
import { pickChips, journeyPrompts } from '../askCore.js';
import JOURNEY_LIST from '../../../data/askJourneyList.json';

const ROOT = path.resolve(__dirname, '../../../..');
const JDIR = path.join(ROOT, 'src/data/askJourneys');
const KB = path.join(ROOT, 'src/data/askKb');
const EXPECTED = ['text-to-video', 'photo-to-clip', 'talking-video', 'product-ad', 'short-film', 'social-shorts', 'explainer-promo', 'ugc-ad-batch'];
const files = fs.existsSync(JDIR) ? fs.readdirSync(JDIR).filter((f) => f.endsWith('.json')).sort() : [];
const journeys = files.map((f) => JSON.parse(fs.readFileSync(path.join(JDIR, f), 'utf8')));
const kbText = (id) => fs.readFileSync(path.join(KB, `${id}.json`), 'utf8');
const kbIds = new Set(fs.readdirSync(KB).filter((f) => f.endsWith('.json') && !f.startsWith('_')).map((f) => f.replace('.json', '')));

// One-click hand-offs that really exist in the code. Anything else must say download + upload.
const VERIFIED_HANDOFFS = ['Use in studio', 'Animate →', 'Send to video studio', 'Send to Storyboard', 'Use in Generator', 'Send to Timeline', 'Storyboard Loaded', 'Create This Style'];
// A manual carry-over, staying in the same place, or an honest 'these are alternatives, no one-click hand-off'.
const MANUAL = /download|upload|library|import|drag|\bstay (in|on)\b|no one-click|alternatives?/i;

describe('journey set', () => {
  it('has the eight planned journeys', () => expect(journeys.map((j) => j.id).sort()).toEqual([...EXPECTED].sort()));
  it('file names match ids', () => files.forEach((f, i) => expect(f).toBe(`${journeys[i].id}.json`)));
});

describe.each(journeys.map((j) => [j.id, j]))('journey %s', (_id, j) => {
  it('has the required fields and a sensible size', () => {
    for (const k of ['title', 'goal', 'bestFor', 'whatYouNeed', 'studios', 'steps', 'checkpoints', 'troubleshooting', 'tips', 'relatedJourneys', 'academy', 'intents', 'notConfirmed', 'sourceFiles', 'verification']) expect(j[k], k).toBeTruthy();
    expect(j.steps.length).toBeGreaterThanOrEqual(5);
    expect(j.steps.length).toBeLessThanOrEqual(9);
    expect(j.intents.length).toBeGreaterThanOrEqual(6);
    expect(j.troubleshooting.length).toBeGreaterThanOrEqual(4);
    expect(j.notConfirmed.length).toBeGreaterThan(0);
    j.steps.forEach((st, i) => expect(st.n, 'step numbers run 1..n').toBe(i + 1));
  });
  it('every studio has a guide and is a real page', () => {
    for (const id of new Set([...j.studios, ...j.steps.map((s) => s.studio)])) {
      expect(kbIds.has(id), `${id} has a guide`).toBe(true);
      expect(isKnownPage(id), `${id} is routed`).toBe(true);
    }
    for (const st of j.steps) expect(j.studios, `step ${st.n} studio is listed`).toContain(st.studio);
  });
  it('every quoted button appears verbatim in that studio\'s guide', () => {
    for (const st of j.steps) {
      const guide = kbText(st.studio);
      for (const b of st.buttons) expect(guide.includes(JSON.stringify(b).slice(1, -1)), `step ${st.n} (${st.studio}): "${b}"`).toBe(true);
    }
  });
  it('hand-offs are real one-click buttons or a download + upload', () => {
    j.steps.forEach((st, i) => {
      const isLast = i === j.steps.length - 1;
      expect(st.handoff, `step ${st.n} handoff`).toBeTruthy();
      if (isLast) return;
      if (j.steps[i + 1].studio === st.studio) return; // same studio: nothing to carry across
      const ok = VERIFIED_HANDOFFS.some((h) => st.handoff.includes(h)) || MANUAL.test(st.handoff);
      expect(ok, `step ${st.n} handoff: ${st.handoff}`).toBe(true);
    });
  });
  it('ends in a finished video you can download', () => {
    const last = j.steps[j.steps.length - 1].result;
    expect(last).toMatch(/video|mp4|film/i);
    expect(last).toMatch(/download|play|save|export/i);
  });
  it('does not state prices, credits or timings', () => {
    const t = JSON.stringify([j.steps, j.whatYouNeed, j.tips, j.checkpoints]);
    expect(t).not.toMatch(/\$\s?\d|\b\d+\s?(credits?|usd|dollars)\b/i);
    // A time limit is only allowed when a studio guide already states it (in-app tips).
    const lessonsDir = j.academy.track ? path.join(ROOT, 'src/content/academy', j.academy.track, 'lessons') : null;
    const lessons = lessonsDir && fs.existsSync(lessonsDir) ? fs.readdirSync(lessonsDir).filter((f) => f.endsWith('.md')).map((f) => fs.readFileSync(path.join(lessonsDir, f), 'utf8')) : [];
    const allKb = [...[...kbIds].map(kbText), ...lessons].join('\n').toLowerCase();
    for (const m of t.matchAll(/\bunder \d+ (seconds|minutes)\b/gi)) expect(allKb.includes(m[0].toLowerCase()), `"${m[0]}" is not in a studio guide or the journey's Academy lesson`).toBe(true);
  });
  it('references real Academy content and valid related journeys', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/content/academy', j.academy.track)), `track ${j.academy.track}`).toBe(true);
    if (j.academy.lesson) expect(fs.existsSync(path.join(ROOT, 'src/content/academy', j.academy.track, 'lessons', `${j.academy.lesson}.md`)), `lesson ${j.academy.lesson}`).toBe(true);
    for (const r of j.relatedJourneys) expect(EXPECTED, `related ${r}`).toContain(r);
    for (const f of j.sourceFiles) expect(fs.existsSync(path.join(ROOT, f)), `source ${f}`).toBe(true);
  });
});

describe('walk-through retrieval', () => {
  const top = (q) => search(q).find((r) => r.chunk.kind === 'journey')?.chunk;
  it.each([
    ['how do I make a video from start to finish', null],
    ['walk me through making a talking video from a photo', 'talking-video'],
    ['make a product ad video', 'product-ad'],
    ['make a short film from a story', 'short-film'],
    ['make a video from a text description', 'text-to-video'],
    ['turn a photo into an animated video clip', 'photo-to-clip'],
    ['make short videos for tiktok and reels', 'social-shorts'],
    ['make an explainer video for my website', 'explainer-promo'],
    ['make a batch of ugc ad videos', 'ugc-ad-batch'],
  ])('%s', (q, id) => {
    const results = search(q);
    expect(results.some((r) => r.chunk.kind === 'journey'), 'a walkthrough is returned').toBe(true);
    if (id) expect(top(q).id).toMatch(new RegExp(`^journey:${id}:`));
    else expect(results[0].chunk.kind).toBe('journey');
  });
  it('recognises walk-through questions', () => {
    expect(isWalkthroughQuestion('Walk me through making a video')).toBe(true);
    expect(isWalkthroughQuestion('how do I make a video from scratch')).toBe(true);
    expect(isWalkthroughQuestion('what is the aspect ratio of storyboard')).toBe(false);
  });
  it('also offers the short-film walkthrough for "turn my photos into a short film"', () => {
    expect(search('turn my photos into a short film').some((r) => r.chunk.id.startsWith('journey:short-film:'))).toBe(true);
  });
  it('studio and model questions are not taken over by walkthroughs', () => {
    expect(search('which video model is best').some((r) => r.chunk.kind === 'model')).toBe(true);
    expect(search('which video model is best').filter((r) => r.chunk.kind === 'journey').length).toBeLessThanOrEqual(1);
    expect(search('how do I remove the background from a photo')[0].chunk.kind).toBe('studio');
  });
  it('still rejects off-topic and keeps studio questions on studios', () => {
    expect(search('who won the world cup in 1998')).toEqual([]);
    expect(search('how do I remove the background from a photo')[0].chunk.studioId).toBe('edit');
  });
  it('hands the model the WHOLE walkthrough in order, then a few other sources', () => {
    const r = search('walk me through making a talking video from a photo').map((x) => x.chunk);
    const own = r.filter((c) => c.kind === 'journey');
    const lead = own[0].id.split(':')[1];
    expect(own[0].id).toMatch(/:overview$/);
    expect(lead).toBe('talking-video');
    // only the lead walkthrough comes in full; any others are a single overview each (at most two)
    expect(new Set(own.filter((c) => c.id.includes(':steps')).map((c) => c.id.split(':')[1])), 'steps from one walkthrough').toEqual(new Set([lead]));
    const others = own.filter((c) => c.id.split(':')[1] !== lead);
    others.forEach((c) => expect(c.id).toMatch(/:overview$/));
    expect(others.length).toBeLessThanOrEqual(2);
    const steps = own.filter((c) => c.id.includes(':steps')).map((c) => c.id);
    const all = journeys.find((j) => j.id === 'talking-video');
    expect(steps.length).toBeGreaterThanOrEqual(2);
    // every step of the journey is present, in order, in the sources the model sees
    const text = own.filter((c) => c.id.includes(':steps')).map((c) => c.text).join('\n');
    all.steps.forEach((st) => expect(text, `step ${st.n}`).toContain(`Step ${st.n}:`));
    expect([...text.matchAll(/Step (\d+):/g)].map((m) => Number(m[1]))).toEqual(all.steps.map((s) => s.n));
    expect(r.filter((c) => c.kind !== 'journey').length).toBeGreaterThanOrEqual(1);
    expect(r.length).toBeLessThanOrEqual(12);
  });
});

describe('panel', () => {
  it('lists every journey in the "Make a video" group, matching the files', () => {
    expect(JOURNEY_LIST.map((j) => j.id).sort()).toEqual(journeys.map((j) => j.id).sort());
    expect(journeyPrompts()).toHaveLength(journeys.length);
    expect(journeyPrompts()[0].prompt).toMatch(/^Walk me through: /);
  });
  it('a walkthrough source gives one chip per studio on the path, plus its course', () => {
    const j = journeys[0];
    const src = [{ kind: 'journey', title: 'x', url: `#/${j.studios[0]}`, studios: j.studios, guideUrl: '#/academy/track/02-ai-filmmaking' }];
    const { chips } = pickChips('', src);
    expect(chips.filter((c) => !c.academy)).toHaveLength(Math.min(5, j.studios.length));
    expect(chips.at(-1)).toMatchObject({ academy: true });
  });
  it('the panel renders the group from journeyPrompts', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/features/ask-smartvideo/AskSmartVideo.js'), 'utf8');
    expect(src).toContain('journeyPrompts()');
    expect(src).toContain("'Make a video'");
  });
});

describe('assistant prompt', () => {
  it('tells the model how to present a walkthrough', () => {
    expect(SYSTEM_PROMPT).toMatch(/Walkthrough/);
    expect(SYSTEM_PROMPT).toMatch(/numbered path/);
    expect(SYSTEM_PROMPT).toMatch(/carry the result/);
  });
});
