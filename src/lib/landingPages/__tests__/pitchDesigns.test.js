import { describe, it, expect } from 'vitest';
import { renderLandingPage } from '../render.js';
import { PITCH_TEMPLATES, TEMPLATES, defaultConfig, applyTemplate, contrastRatio, blend, readableOn } from '../templates.js';

const VIDEO = 'https://x.supabase.co/storage/v1/object/public/uploads/u/clip.mp4';
const full = (id) => ({
  ...defaultConfig(id, { brand: { name: 'Northbrand Analytics' } }),
  ctas: [
    { label: 'Book a call', kind: 'calendar', value: '', style: 'primary' },
    { label: 'See pricing', kind: 'link', value: 'https://example.com/pricing', style: 'secondary' },
    { label: 'Download one-pager', kind: 'download', value: 'https://example.com/one-pager.pdf', style: 'text' },
  ],
  calendar: { url: 'https://calendly.com/dean/intro', title: 'Pick a time with Jordan' },
  transcript: { enabled: true, items: [{ t: 0, text: 'Hi Maya, thanks for taking a look.' }, { t: 12, text: 'Here is the idea in one minute.' }] },
  countdown: { enabled: true, endsAt: new Date(Date.now() + 3 * 864e5).toISOString(), label: 'Offer ends in' },
});
const page = (config) => ({ id: 'abc12345', title: 'Pitch', video_url: VIDEO, poster_url: null, duration: 92, config });
const maya = { firstname: 'Maya', company: 'Brightline' };
const solid = (t, key) => {
  const v = t.vars[`--vp-${key}`];
  return v.startsWith('#') ? v : t.approx[key]; // translucent surfaces (Glass) are checked on their solid equivalent
};

describe('the pitch designs', () => {
  it('there are the original plus ten new designs, all unique', () => {
    expect(PITCH_TEMPLATES).toHaveLength(11);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(new Set(PITCH_TEMPLATES.map((t) => t.name)).size).toBe(11);
    expect(new Set(PITCH_TEMPLATES.map((t) => `${t.theme.bg}|${t.theme.accent}|${t.vars?.['--vp-card'] || 'w'}`)).size).toBe(11);
  });

  it('each new design differs in look and structure, not just one colour', () => {
    const sig = PITCH_TEMPLATES.slice(1).map((t) => `${t.theme.mode}|${t.theme.font}|${t.radius}|${t.traits.join('+')}`);
    expect(new Set(sig).size).toBe(10);
    const layouts = PITCH_TEMPLATES.flatMap((t) => t.traits).filter((x) => ['transcript-left', 'transcript-below', 'banner', 'brutal', 'glass', 'round', 'sharp', 'rules'].includes(x));
    expect(new Set(layouts).size).toBe(8); // eight different structural/shape treatments across the family
  });

  it('colour variables are plain colour/shadow values (no urls, no script)', () => {
    PITCH_TEMPLATES.filter((t) => t.vars).forEach((t) => {
      Object.values(t.vars).forEach((v) => expect(v).toMatch(/^[#a-z0-9(),.%\s-]+$/i));
    });
  });
});

describe.each(PITCH_TEMPLATES.slice(1).map((t) => [t.name, t]))('%s: readability', (_n, t) => {
  const text = t.theme.text;
  const card = solid(t, 'card');
  const surface = solid(t, 'surface');
  const timeColor = t.vars['--vp-time'] || t.theme.accent;
  it('text on the card is highly legible', () => expect(contrastRatio(text, card)).toBeGreaterThanOrEqual(7));
  it('muted text still passes AA', () => expect(contrastRatio(blend(text, card, 0.65), card)).toBeGreaterThanOrEqual(4.5));
  it('button text is readable on the accent', () => expect(contrastRatio(readableOn(t.theme.accent), t.theme.accent)).toBeGreaterThanOrEqual(4.5));
  it('the button shape stands out from the card (3:1)', () => expect(contrastRatio(t.theme.accent, card)).toBeGreaterThanOrEqual(3));
  it('transcript text and timestamps are readable on the panel', () => {
    expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(timeColor, surface)).toBeGreaterThanOrEqual(4.5);
  });
});

describe.each(PITCH_TEMPLATES.map((t) => [t.name, t]))('%s: renders the full pitch anatomy', (_n, t) => {
  const v = renderLandingPage({ page: page(full(t.id)), tokens: maya });
  const q = (s) => v.root.querySelector(s);

  it('has header, headline, video, action row, calendar and transcript', () => {
    expect(q('.vp-brand-name').textContent).toBe('Northbrand Analytics');
    expect(q('.vp-headline').textContent).toBe('Hi Maya, a quick idea for Brightline');
    expect(q('.vp-player video')).not.toBeNull();
    expect([...v.root.querySelectorAll('.vp-actions .vp-btn')].map((b) => b.textContent)).toEqual(['Book a call', 'See pricing', 'Download one-pager']);
    expect(q('.vp-like')).not.toBeNull();
    expect(q('.vp-calendar iframe').getAttribute('src')).toBe('https://calendly.com/dean/intro');
    expect(q('.vp-transcript')).not.toBeNull();
    expect(q('.vp-countdown')).not.toBeNull();
    expect(q('.vp-card')).not.toBeNull();
  });

  it('carries its own class, traits, radius and colour variables', () => {
    expect(v.root.classList.contains(`vp--${t.id}`)).toBe(true);
    t.traits.forEach((tr) => expect(v.root.classList.contains(`vp--t-${tr}`)).toBe(true));
    expect(v.root.style.getPropertyValue('--vp-radius')).toBe(`${t.radius}px`);
    Object.entries(t.vars || {}).forEach(([k, val]) => expect(v.root.style.getPropertyValue(k)).toBe(val));
  });
});

describe('layout differences', () => {
  const render = (id) => renderLandingPage({ page: page(full(id)), tokens: maya });

  it('Banner moves the header and headline into a coloured band above the video', () => {
    const v = render('pitch-banner');
    const card = v.root.querySelector('.vp-card');
    const banner = card.querySelector(':scope > .vp-banner');
    expect(banner).not.toBeNull();
    expect(banner.querySelector('.vp-top')).not.toBeNull();
    expect(banner.querySelector('.vp-headline').textContent).toContain('Maya');
    expect(card.querySelector('.vp-pitch-main .vp-headline')).toBeNull(); // headline lives in the banner now
    expect([...card.children].map((n) => n.className.split(' ')[0]).slice(0, 2)).toEqual(['vp-banner', 'vp-main']);
  });

  it('other designs have no banner and keep the header in the card', () => {
    const v = render('pitch-midnight');
    expect(v.root.querySelector('.vp-banner')).toBeNull();
    expect(v.root.querySelector('.vp-card > .vp-top')).not.toBeNull();
  });

  it('Ocean puts the transcript before the video column; Stacked keeps it after', () => {
    expect(render('pitch-ocean').root.classList.contains('vp--t-transcript-left')).toBe(true);
    expect(render('pitch-stack').root.classList.contains('vp--t-transcript-below')).toBe(true);
    expect(render('pitch-stack').root.classList.contains('vp--t-center')).toBe(true);
  });

  it('every pitch design works without a transcript, calendar or countdown', () => {
    PITCH_TEMPLATES.forEach((t) => {
      const v = renderLandingPage({ page: page(defaultConfig(t.id)), tokens: {} });
      expect(v.root.querySelector('.vp-transcript')).toBeNull();
      expect(v.root.querySelector('.vp-calendar')).toBeNull();
      expect(v.root.querySelector('.vp-countdown')).toBeNull();
      expect(v.root.querySelector('.vp-headline').textContent).toBe('Hi there, a quick idea for your team');
    });
  });

  it('switching between pitch designs keeps the user words and buttons', () => {
    const mine = { ...full('pitch'), headline: 'My own headline', subhead: 'My own sub' };
    PITCH_TEMPLATES.forEach((t) => {
      const next = applyTemplate(mine, t.id);
      expect(next.template).toBe(t.id);
      expect(next.headline).toBe('My own headline');
      expect(next.ctas).toHaveLength(3);
      expect(next.theme.accent).toBe(t.theme.accent);
    });
  });
});
