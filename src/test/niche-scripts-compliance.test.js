// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NICHE_SCRIPTS, needsRealQuote, REAL_QUOTE_NOTICE } from '../lib/nicheScripts/index.js';
import { ALL_NICHE_TEMPLATES } from '../lib/nicheTemplatesIndex.js';
import { TemplateGeneratorModal } from '../components/modals/TemplateGeneratorModal.jsx';
import { STEPS } from '../components/modals/template-generator/rules.js';
import { createTemplateStore } from '../components/modals/template-generator/templates.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const textOf = (s) => [...s.lines, s.cta].join(' ');
// A disclaimer is allowed to name the thing it disclaims ("results are not guaranteed", "did not ask for a miracle").
const withoutDisclaimers = (t) => t
  .replace(/\b(?:results )?(?:are|is) not guaranteed\b/gi, '').replace(/\b(?:do|does) not guarantee\b/gi, '').replace(/\bnothing here guarantees\b/gi, '')
  .replace(/\bdid not ask for a miracle\b/gi, '').replace(/\bpast results do not guarantee\b/gi, '');

describe('the 120 written scripts stay within advertising rules', () => {
  const entries = Object.entries(NICHE_SCRIPTS);
  const FORBIDDEN = [
    [/\bguarantee[sd]?\b/i, 'a guarantee'], [/\b100%\b/, '100%'], [/\b(?:risk[- ]free|no risk)\b/i, 'risk-free'],
    [/\b(?:cure[sd]?|painless|pain[- ]free|miracle|clinically proven)\b/i, 'a medical claim'], [/\bfda\b/i, 'FDA'],
    [/\b(?:best in|#1|number one|top[- ]rated|award[- ]winning|world[- ]class|lowest price|cheapest|the best (?:seat|dentist|doctor|lawyer|attorney|salon|restaurant|agent|in))\b/i, 'an unsubstantiated superlative'],
    [/\b(?:win your case|maximum compensation|guaranteed (?:result|outcome|settlement))\b/i, 'a legal outcome promise'],
    [/\b(?:perfect for|ideal for) (?:families|couples|young|singles)\b|\bsafe neighborhood\b/i, 'a fair-housing risk'],
    [/\b(?:last chance|act now|only \d+ left)\b/i, 'false urgency'],
  ];

  it('covers every template, one line per scene, short enough to be read aloud', () => {
    expect(entries).toHaveLength(120);
    const byId = new Map(ALL_NICHE_TEMPLATES.map((t) => [t.id, t]));
    for (const [id, s] of entries) {
      expect(byId.has(id), id).toBe(true);
      expect(s.lines.length, id).toBe(byId.get(id).sceneStructure.length);
      expect(textOf(s).length, id).toBeLessThanOrEqual(1500);
    }
  });

  it('has no unqualified guarantees, medical claims, invented superlatives, outcome promises or fair-housing risks', () => {
    const hits = [];
    for (const [id, s] of entries) {
      const t = withoutDisclaimers(textOf(s));
      for (const [re, why] of FORBIDDEN) if (re.test(t)) hits.push(`${id}: ${why} (${t.match(re)[0]})`);
    }
    expect(hits).toEqual([]);
  });

  it('flags every testimonial / quote script as example wording that must be replaced with a real customer\'s words', () => {
    const testimonials = entries.map(([id]) => id).filter((id) => /testimonial/i.test(id));
    expect(testimonials.length).toBeGreaterThanOrEqual(6);
    for (const id of testimonials) expect(needsRealQuote(id), id).toBe(true);
    expect(needsRealQuote('sold_story_feature')).toBe(true);
    expect(needsRealQuote('speaker_cut_spotlight')).toBe(true);
    expect(needsRealQuote('midnight_table_film')).toBe(false);
    expect(needsRealQuote('nope')).toBe(false);
  });
});

describe('Template Generator — example testimonials', () => {
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });
  const open = (extra = {}) => {
    vi.stubGlobal('VideoEncoder', function VideoEncoder() {});
    const m = new TemplateGeneratorModal({ defaultProvider: 'pixabay', templateCatalog: async () => { throw new Error('offline'); }, stockSearch: async () => ({ items: [], hasMore: false }), templateStore: createTemplateStore(memory()), ...extra });
    m.open(); m.s.started = true; m.s.selectedVideos = [1, 2].map((n) => ({ id: `v${n}`, kind: 'video', source: 'x', title: `C${n}`, url: `https://x.test/${n}.mp4`, poster: '', duration: 6 })); m.paint();
    return m;
  };

  it('shows the notice on the script card popup and the Script step while the example words are unchanged, and not once edited', () => {
    const m = open();
    m.setPopup({ kind: 'script', id: 'client_glow_testimonial' });
    expect(document.querySelector('.tg-popup .tg-status--warn').textContent).toContain('real customer');
    m.setPopup(null);
    m.pickScript('client_glow_testimonial'); m.s.details.business_name = 'Glow'; m.s.step = STEPS.SCRIPT; m.paint();
    expect(document.querySelector('#tg-quote-note').textContent).toBe(REAL_QUOTE_NOTICE);
    m.s.script.text = 'My own real customer words here.'; m.paint();
    expect(document.querySelector('#tg-quote-note')).toBeNull();
    m.pickScript('midnight_table_film'); m.paint();
    expect(document.querySelector('#tg-quote-note')).toBeNull();
    m.destroy();
  });

  it('exporting a video that still has the example testimonial asks first, and goes ahead on a second click', async () => {
    const exportVideo = vi.fn(async () => ({ filename: 'a.mp4', fileSize: 0 }));
    const m = open({ exportVideo });
    m.pickScript('client_glow_testimonial'); m.s.details = { business_name: 'Glow', city: 'Austin', offer: 'x', about: '' }; m._applyTemplateScript?.(); m.s.step = STEPS.PREVIEW; m.paint();
    expect(m.exampleQuoteStillIn()).toBe(true);
    document.querySelector('#tg-export').click();
    await vi.waitFor(() => expect(document.querySelector('#tg-exportstatus .tg-status--error').textContent).toContain('real customer'));
    expect(exportVideo).not.toHaveBeenCalled();
    document.querySelector('#tg-export').click();
    await vi.waitFor(() => expect(exportVideo).toHaveBeenCalledTimes(1));
    m.destroy();
  });
});
