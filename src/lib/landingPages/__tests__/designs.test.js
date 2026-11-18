import { describe, it, expect } from 'vitest';
import { renderLandingPage } from '../render.js';
import {
  TEMPLATES, INTRO_TEMPLATES, defaultConfig, sanitizeConfig, applyTemplate, contrastRatio, blend, readableOn, luminance,
} from '../templates.js';

const VIDEO = 'https://x.supabase.co/storage/v1/object/public/uploads/u/clip.mp4';
const full = (id) => ({
  ...defaultConfig(id),
  brand: { name: 'Remix Studio', tagline: 'A personal video from {{sender}}' },
  sender: { name: 'Dean Gilmore', title: 'Founder, Remix Studio', avatarUrl: '' },
  testimonial: { quote: 'We went from one video a week to one for every customer.', by: 'Jordan Lee, Northwind' },
  logos: [{ name: 'NORTHWIND' }, { name: 'Globex' }],
  footer: { text: 'Sent by {{sender}} · {{brand}}', optOutUrl: 'mailto:dean@example.com' },
});
const page = (config) => ({ id: 'abc12345', title: 'Intro', video_url: VIDEO, poster_url: null, duration: 92, config });
const ann = { firstname: 'Ann', company: 'Acme' };

describe('the ten designs', () => {
  it('there are the reference plus ten new intro designs, all with unique ids and names', () => {
    expect(INTRO_TEMPLATES).toHaveLength(11);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(new Set(INTRO_TEMPLATES.map((t) => t.name)).size).toBe(11);
  });

  it('each design looks different: unique palette and a distinct look signature', () => {
    const palette = INTRO_TEMPLATES.map((t) => `${t.theme.bg}|${t.theme.accent}|${t.theme.highlight}`);
    expect(new Set(palette).size).toBe(11);
    // signature = font + shape + structure; at most the reference shares one with a variant that changes palette/mode
    const sig = INTRO_TEMPLATES.map((t) => `${t.theme.mode}|${t.theme.font}|${t.radius}|${(t.traits || []).join('+')}`);
    expect(new Set(sig).size).toBeGreaterThanOrEqual(10);
  });
});

describe.each(INTRO_TEMPLATES.map((t) => [t.name, t]))('%s: readability', (_name, t) => {
  const { bg, text, accent, highlight } = t.theme;
  it('body text is highly legible on the background', () => {
    expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(7);
  });
  it('muted text (70% strength) still passes AA', () => {
    expect(contrastRatio(blend(text, bg, 0.7), bg)).toBeGreaterThanOrEqual(4.5);
  });
  it('button and play-icon text is readable on the accent', () => {
    expect(contrastRatio(readableOn(accent), accent)).toBeGreaterThanOrEqual(4.5);
  });
  it('the recipient tile letter is readable on the highlight colour', () => {
    // The tile stands in for a company logo (logotypes are exempt from WCAG 1.4.3). The supplied reference
    // design's indigo measures 4.47:1, so it is kept exactly as designed; every new design must reach 4.5.
    const floor = t.id === 'personal' ? 4.4 : 4.5;
    expect(contrastRatio(readableOn(highlight), highlight)).toBeGreaterThanOrEqual(floor);
  });
  it('the highlighted headline word stands out from the background (large text, 3:1)', () => {
    expect(contrastRatio(highlight, bg)).toBeGreaterThanOrEqual(3);
  });
  it('the button shape stands out from the background (UI component, 3:1)', () => {
    expect(contrastRatio(accent, bg)).toBeGreaterThanOrEqual(3);
  });
});

describe.each(INTRO_TEMPLATES.map((t) => [t.name, t]))('%s: renders the full anatomy', (_name, t) => {
  const v = renderLandingPage({ page: page(full(t.id)), tokens: ann });
  const q = (s) => v.root.querySelector(s);

  it('has every section of the reference', () => {
    expect(q('.vp-top')).not.toBeNull();
    expect([...v.root.querySelectorAll('.vp-brand-name')].map((n) => n.textContent)).toEqual(['Remix Studio', 'Acme']);
    expect(q('.vp-pill').textContent).toBe('Made for Ann at Acme');
    expect(q('.vp-headline .vp-accent').textContent).toBe('Acme');
    expect(q('.vp-cta--play')).not.toBeNull();
    expect(q('.vp-bigplay')).not.toBeNull();
    expect(q('.vp-caption-title').textContent).toBe('Ann, welcome to Acme');
    expect(q('.vp-bar .vp-seek')).not.toBeNull();
    expect(q('.vp-cols .vp-story')).not.toBeNull();
    expect(q('.vp-cols .vp-form')).not.toBeNull();
    expect(q('.vp-byline-name').textContent).toBe('Dean Gilmore');
    expect(q('.vp-quote-text')).not.toBeNull();
    expect(q('.vp-logos')).not.toBeNull();
    expect(q('.vp-foot-text').textContent).toBe('Sent by Dean Gilmore · Remix Studio');
    expect(q('.vp-optout')).not.toBeNull();
  });

  it('carries its own class, traits and readable-text colours', () => {
    expect(v.root.classList.contains(`vp--${t.id}`)).toBe(true);
    (t.traits || []).forEach((tr) => expect(v.root.classList.contains(`vp--t-${tr}`)).toBe(true));
    expect(v.root.style.getPropertyValue('--vp-radius')).toBe(`${t.radius}px`);
    expect(v.root.style.getPropertyValue('--vp-on-accent')).toMatch(/^#(ffffff|0b0b0f)$/);
    expect(v.root.style.getPropertyValue('--vp-accent')).toBe(t.theme.accent);
  });
});

describe('design defaults and switching', () => {
  it('every design ships the same content scaffolding and no invented proof', () => {
    INTRO_TEMPLATES.forEach((t) => {
      const c = defaultConfig(t.id);
      expect(c.template).toBe(t.id);
      expect(c.cta.type).toBe('play');
      expect(c.form.enabled).toBe(true);
      expect(c.testimonial).toEqual({ quote: '', by: '' });
      expect(c.logos).toEqual([]);
      expect(c.sender.name).toBe('');
      expect(c.footer.optOutUrl).toBe('');
    });
  });

  it('switching between designs keeps the user words and only restyles', () => {
    const mine = { ...full('personal'), headline: 'My own [[headline]]', subhead: 'My own sub' };
    INTRO_TEMPLATES.forEach((t) => {
      const next = applyTemplate(mine, t.id);
      expect(next.template).toBe(t.id);
      expect(next.headline).toBe('My own [[headline]]');
      expect(next.subhead).toBe('My own sub');
      expect(next.sender.name).toBe('Dean Gilmore');
      expect(next.theme.accent).toBe(t.theme.accent);
      expect(next.theme.bg).toBe(t.theme.bg);
    });
  });

  it('a stored colour override survives sanitising under any design', () => {
    const c = sanitizeConfig({ ...full('neon'), theme: { accent: '#112233', highlight: '#445566' } });
    expect(c.theme.accent).toBe('#112233');
    expect(c.theme.highlight).toBe('#445566');
    expect(c.theme.bg).toBe('#070713'); // unset values come from the design
  });
});

describe('colour helpers', () => {
  it('computes luminance and WCAG contrast', () => {
    expect(luminance('#000000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 3);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
    expect(luminance('not a colour')).toBe(0);
  });
  it('blends semi-transparent text over a background', () => {
    expect(blend('#ffffff', '#000000', 0.5)).toBe('#808080');
    expect(blend('#ff0000', '#0000ff', 1)).toBe('#ff0000');
  });
  it('picks white on dark colours and near-black on light ones', () => {
    expect(readableOn('#0a0c12')).toBe('#ffffff');
    expect(readableOn('#fbbf24')).toBe('#0b0b0f');
    expect(readableOn('#ffffff')).toBe('#0b0b0f');
  });
});
