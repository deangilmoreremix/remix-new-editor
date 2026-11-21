// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { STEPS, createWizardState, toBuilderState, previewTexts, splitCaption } from '../components/modals/template-generator/rules.js';
import { createTemplateStore, snapshotTemplate, restoreTemplate } from '../components/modals/template-generator/templates.js';
import { resolveTextStyle, withTextStyle, withPreset, presetOf, presetStyle, ROLE_DEFAULTS, TEXT_PRESETS } from '../components/modals/template-generator/textStyles.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const clip = (n) => ({ id: `v${n}`, kind: 'video', source: 'x', title: `Clip ${n}`, url: `https://x.test/${n}.mp4`, poster: `https://x.test/${n}.jpg`, duration: 6 });
const wizard = () => {
  const s = createWizardState();
  s.selectedVideos = [clip(1), clip(2)];
  s.script.text = 'First line of the story.\nSecond line to close.';
  s.elements.title = 'Summer Sale';
  s.elements.cta = 'Book now';
  return s;
};

describe('text looks', () => {
  it('every role starts on a good default look and box, and old records (no styles) get it too', () => {
    for (const role of Object.keys(ROLE_DEFAULTS)) {
      const st = resolveTextStyle({}, role);
      expect(st.fontFamily, role).toBeTruthy();
      expect(st.geometry.width, role).toBeGreaterThan(30);
      expect(st.fontDecorations.responsive).toBe(true);           // text scales to fit its box, never overflows
    }
    expect(resolveTextStyle({ captions: true }, 'caption').stroke || resolveTextStyle({}, 'caption').shadow).toBeTruthy();   // readable on any footage
  });

  it('saves only what the user changed, and a preset keeps the box they moved', () => {
    const el = { styles: {} };
    el.styles = withTextStyle(el, 'title', { geometry: { left: 20, top: 30, width: 50, height: 15 } });
    el.styles = withPreset(el, 'title', 'neon');
    expect(presetOf(el, 'title')).toBe('neon');
    const st = resolveTextStyle(el, 'title');
    expect(st.fontColor).toBe(TEXT_PRESETS.neon.fontColor);
    expect(st.geometry).toEqual({ left: 20, top: 30, width: 50, height: 15 });
    expect(st.preset).toBeUndefined();
    expect(Object.keys(el.styles)).toEqual(['title']);                // other roles untouched
    expect(presetStyle('caption', 'box').background).toBe(true);
  });

  it('every text clip the wizard builds carries its role and complete style', () => {
    const s = wizard();
    s.elements.styles = withPreset(s.elements, 'title', 'karaoke');
    const o = toBuilderState(s).overlays;
    const caption = o.find((x) => x.role === 'caption');
    const title = o.find((x) => x.role === 'title');
    expect(caption.textStyle.geometry).toBeTruthy();
    expect(title.textStyle.fontColor).toBe(TEXT_PRESETS.karaoke.fontColor);
    expect(o.find((x) => x.role === 'cta').text).toBe('Book now');
    expect(previewTexts(s).map((t) => t.role).sort()).toEqual(['caption', 'caption', 'cta', 'title']);
  });

  it('saved templates keep the text looks and old ones still load', () => {
    const s = wizard();
    s.elements.styles = withPreset(s.elements, 'cta', 'box');
    const rec = JSON.parse(JSON.stringify(snapshotTemplate(s, { name: 'T' })));
    const back = restoreTemplate(rec, () => null);
    expect(presetOf(back.elements, 'cta')).toBe('box');
    delete rec.elements.styles;
    expect(restoreTemplate(rec, () => null).elements.styles).toEqual({});   // an old record gets the defaults
  });
});

describe('long captions', () => {
  it('a long line becomes a few short captions in turn, covering the whole scene with no gaps', () => {
    const long = 'When the city slows down and the lights drop low, Your business comes alive. Candlelight on polished wood, the hum of quiet conversation, and an evening that belongs entirely to you.';
    const parts = splitCaption(long);
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.every((p) => p.length <= 90)).toBe(true);
    expect(parts.join(' ')).toBe(long);
    const s = wizard(); s.script.text = `${long}\nShort close.`;
    const caps = toBuilderState(s).overlays.filter((o) => o.role === 'caption');
    const first = caps.filter((c) => c.sceneIndex === 0);
    expect(first.length).toBe(parts.length);
    expect(first[0].startTime).toBe(0);
    expect(first.at(-1).startTime + first.at(-1).duration).toBeCloseTo(6, 1);
    for (let i = 1; i < first.length; i += 1) expect(first[i].startTime).toBeCloseTo(first[i - 1].startTime + first[i - 1].duration, 1);
    expect(caps.find((c) => c.sceneIndex === 1).startTime).toBe(6);
  });
});

describe('Preview step — text on the video', () => {
  afterEach(() => { document.body.innerHTML = ''; });
  const open = () => {
    const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', templateCatalog: async () => { throw new Error('offline'); }, stockSearch: async () => ({ items: [], hasMore: false }), templateStore: createTemplateStore(memory()) });
    m.open(); Object.assign(m.s, wizard()); m.s.started = true; m.s.step = STEPS.PREVIEW; m.paint();
    return m;
  };

  it('draws the text with the editor renderer at the playhead (title first), not a plain caption pill', () => {
    const m = open();
    const layer = document.querySelector('.tg-player__layer.addon-overlay-layer');
    expect(layer).toBeTruthy();
    const texts = [...layer.querySelectorAll('.popcorn-text')];
    expect(texts.map((t) => t.textContent)).toEqual(expect.arrayContaining(['Summer Sale']));
    expect(texts.find((t) => t.textContent === 'Summer Sale').querySelector('.text-inner-div').style.fontFamily).toContain('Anton');
    expect(document.querySelector('.tg-player__caption').hidden).toBe(true);
    m.destroy();
  });

  it('click a text role → presets and controls; a preset and a colour change the look; the text field edits the words', () => {
    const m = open();
    document.querySelector('[data-act="text-role"][data-id="title"]').click();
    expect(document.querySelectorAll('.tg-preset').length).toBe(Object.keys(TEXT_PRESETS).length);
    document.querySelector('.tg-preset[data-id="neon"]').click();
    expect(presetOf(m.s.elements, 'title')).toBe('neon');
    const inner = () => document.querySelector('.tg-player__layer [data-clip-id^="title-"] .text-inner-div');
    expect(inner().style.color).toMatch(/rgb\(34, 211, 238\)|#22d3ee/i);
    const color = document.querySelector('input[data-tstyle="fontColor"]'); color.value = '#ff0000'; color.dispatchEvent(new Event('input', { bubbles: true }));
    expect(resolveTextStyle(m.s.elements, 'title').fontColor).toBe('#ff0000');
    const field = document.querySelector('input[data-tbind="title"]'); field.value = 'Winter Sale'; field.dispatchEvent(new Event('input', { bubbles: true }));
    expect(m.s.elements.title).toBe('Winter Sale');
    expect(document.querySelector('.tg-player__layer').textContent).toContain('Winter Sale');
    document.querySelector('[data-act="text-reset"]').click();
    expect(m.s.elements.styles.title).toBeUndefined();
    m.destroy();
  });

  it('the selected text gets drag / resize handles that save its new box', () => {
    const m = open();
    document.querySelector('[data-act="text-role"][data-id="title"]').click();
    const el = document.querySelector('.tg-player__layer [data-clip-id^="title-"]');
    expect(el.classList.contains('overlay-selected')).toBe(true);
    expect(el.querySelectorAll('.overlay-handle').length).toBe(4);
    m._setTextStyle('title', { geometry: { left: 5, top: 5, width: 60, height: 20 } });   // what a drag commits
    expect(resolveTextStyle(m.s.elements, 'title').geometry.width).toBe(60);
    expect(toBuilderState(m.s).overlays.find((o) => o.role === 'title').textStyle.geometry.left).toBe(5);
    m.destroy();
  });
});
