import { describe, it, expect, vi } from 'vitest';
import { renderLandingPage } from '../render.js';
import { SITE_TEMPLATES } from '../siteTemplates.js';
import {
  TEMPLATES, SITE_PAGE_TEMPLATES, STRUCTURE_TEMPLATES, defaultConfig, sanitizeConfig, sanitizeSite, applyTemplate,
  SITE_CARD_TYPES, contrastRatio, readableOn, blend,
} from '../templates.js';
import { CARD_TYPES } from '../siteLayout.js';
import { ICON_KEYS } from '../siteIcons.js';
import { wireframeSvg, WIREFRAME_LAYOUTS } from '../wireframes.js';

const VIDEO = 'https://x.supabase.co/storage/v1/object/public/uploads/u/clip.mp4';
const IDS = SITE_TEMPLATES.map((t) => t.id);
const page = (config) => ({ id: 'abc12345', title: 'Intro', video_url: VIDEO, poster_url: null, duration: 84, config });
const render = (id, o = {}) => renderLandingPage({ page: page(defaultConfig(id, { brand: { name: 'Acme Video' } })), tokens: { firstname: 'Maya', company: 'Brightline' }, ...o });

describe('site templates', () => {
  it('are the five designs of batch 1, registered once, with a wireframe each', () => {
    expect(IDS).toEqual(['site-leadiq', 'site-lead', 'site-reach', 'site-persona', 'site-spark']);
    expect(SITE_PAGE_TEMPLATES.map((t) => t.id)).toEqual(IDS);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    IDS.forEach((id) => expect(WIREFRAME_LAYOUTS).toContain(id));
    expect(new Set(IDS.map((id) => wireframeSvg(id))).size).toBe(IDS.length);
    expect(STRUCTURE_TEMPLATES.some((t) => t.site)).toBe(false);
  });
  it('the renderer and sanitiser agree on card types and icons', () => {
    expect([...CARD_TYPES].sort()).toEqual([...SITE_CARD_TYPES].sort());
    SITE_TEMPLATES.forEach((t) => {
      t.site.cards.forEach((c) => expect(SITE_CARD_TYPES).toContain(c.type));
      [...t.site.strip.items, ...t.site.cards.flatMap((c) => c.items || [])].forEach((i) => { if (i.icon) expect(ICON_KEYS).toContain(i.icon); });
    });
  });
  it('sample content survives sanitising unchanged (nothing silently dropped)', () => {
    SITE_TEMPLATES.forEach((t) => {
      const clean = sanitizeConfig(defaultConfig(t.id)).site;
      expect(clean.cards).toHaveLength(t.site.cards.length);
      expect(clean.strip.items).toHaveLength(t.site.strip.items.length);
      expect(clean.nav.links).toHaveLength(t.site.nav.links.length);
      expect(clean.hero.bullets).toEqual(t.site.hero.bullets);
    });
  });
});

describe.each(IDS)('%s renders', (id) => {
  const v = render(id);
  const q = (s) => v.root.querySelector(s);
  const n = (s) => v.root.querySelectorAll(s).length;
  it('with every block exactly once and the shared video / form', () => {
    expect(n('video')).toBe(1);
    expect(n('.vp-sitenav')).toBe(1);
    expect(n('.vp-sitehero')).toBe(1);
    expect(n('.vp-headline')).toBe(1);
    expect(n('.vp-form')).toBe(1);
    expect(n('.vp-band')).toBe(1);
    expect(n('.vp-sh-video video')).toBe(1);
    expect(n('.vp-sh-form .vp-form')).toBe(1);
    const t = SITE_TEMPLATES.find((x) => x.id === id);
    expect(n('.vp-cards > .vp-card')).toBe(t.site.cards.length);
    expect(n('.vp-navlink')).toBe(t.site.nav.links.length);
  });
  it('greets the contact by name and keeps the design class', () => {
    expect(q('.vp-headline').textContent).not.toMatch(/\{\{|\[\[/);
    expect(v.root.classList.contains(`vp--${id}`)).toBe(true);
    if (id === 'site-leadiq') expect(q('.vp-chip').textContent).toBe('Personal Video for Maya');
  });
  it('is adaptive for wide, tall and square video', () => {
    expect(q('.vp-frame').classList.contains('is-adaptive')).toBe(true);
  });
  it('names the brand and has no empty text nodes where copy was blank', () => {
    expect(q('.vp-sitebrand .vp-brand-name').textContent).toBe('Acme Video');
    expect(n('.vp-card-title:empty')).toBe(0);
  });
});

describe('hero arrangement', () => {
  it('places the secondary button where the design puts it', () => {
    // A calendar button only exists once a calendar is connected (no dead buttons), and so does its "or" divider.
    expect(render('site-leadiq').root.querySelector('.vp-sh-form .vp-or')).toBeNull();
    const withCal = { ...defaultConfig('site-leadiq'), calendar: { url: 'https://calendly.com/dean/intro', title: 'Pick a time' } };
    const c = renderLandingPage({ page: page(withCal), tokens: {} }).root;
    expect(c.querySelector('.vp-sh-form .vp-or')).not.toBeNull();
    expect(c.querySelector('.vp-sh-form .vp-actions .vp-btn').textContent).toBe('Book a 15-Min Strategy Call');
    const persona = render('site-persona').root;
    expect(persona.querySelector('.vp-sh-copy .vp-actions .vp-btn')).not.toBeNull();
    expect(persona.querySelector('.vp-sh-form .vp-actions')).toBeNull();
    expect(render('site-lead').root.querySelector('.vp-actions')).toBeNull();
  });
  it('video-first designs say so in their variant class', () => {
    expect(render('site-leadiq').root.querySelector('.vp-site--video-copy-form')).not.toBeNull();
    expect(render('site-persona').root.querySelector('.vp-site--video-copy-form')).not.toBeNull();
    expect(render('site-lead').root.querySelector('.vp-site--copy-video-form')).not.toBeNull();
  });
  it('without a form the hero still renders', () => {
    const cfg = { ...defaultConfig('site-lead'), form: { ...defaultConfig('site-lead').form, enabled: false } };
    const v = renderLandingPage({ page: page(cfg), tokens: {} });
    expect(v.root.querySelector('.vp-sh-form')).toBeNull();
    expect(v.root.querySelector('.vp-sh-video video')).not.toBeNull();
  });
});

describe('sign-up forms', () => {
  it('the playbook and band forms send the email through the page lead handler', async () => {
    const onLead = vi.fn().mockResolvedValue({ stored: true });
    const v = renderLandingPage({ page: page(defaultConfig('site-leadiq')), tokens: {}, handlers: { onLead } });
    const forms = v.root.querySelectorAll('.vp-mini');
    expect(forms.length).toBe(2);
    const input = forms[0].querySelector('input');
    input.value = 'lead@example.com';
    forms[0].dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await Promise.resolve(); await Promise.resolve();
    expect(onLead).toHaveBeenCalledTimes(1);
    expect(onLead.mock.calls[0][0].email).toBe('lead@example.com');
    expect(forms[0].textContent).toContain('Thanks');
  });
  it('shows an error, and re-enables the button, when sending fails', async () => {
    const onLead = vi.fn().mockResolvedValue({ error: 'x' });
    const v = renderLandingPage({ page: page(defaultConfig('site-spark')), tokens: {}, handlers: { onLead } });
    const f = v.root.querySelector('.vp-mini');
    f.querySelector('input').value = 'a@b.co';
    f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    await Promise.resolve(); await Promise.resolve();
    expect(f.querySelector('.vp-mini-status').textContent).toMatch(/Could not send/);
    expect(f.querySelector('.vp-mini-btn').disabled).toBe(false);
  });
  it('sends nothing in preview', () => {
    const onLead = vi.fn();
    const v = renderLandingPage({ page: page(defaultConfig('site-spark')), tokens: {}, handlers: { onLead }, preview: true });
    const f = v.root.querySelector('.vp-mini');
    f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    expect(onLead).not.toHaveBeenCalled();
    expect(f.querySelector('.vp-mini-status').textContent).toMatch(/Preview only/);
  });
});

describe('the nav', () => {
  it('only links to safe URLs and opens external ones safely', () => {
    const cfg = defaultConfig('site-lead');
    cfg.site.nav.links = [{ label: 'Bad', url: 'javascript:alert(1)' }, { label: 'Good', url: 'https://example.com/x' }, { label: 'Plain', url: '' }];
    cfg.site.nav.loginUrl = 'javascript:alert(2)';
    const v = renderLandingPage({ page: page(cfg), tokens: {} });
    const links = [...v.root.querySelectorAll('.vp-navlink')];
    expect(links.map((l) => l.tagName)).toEqual(['SPAN', 'A', 'SPAN']);
    expect(links[1].getAttribute('href')).toBe('https://example.com/x');
    expect(links[1].getAttribute('rel')).toContain('noopener');
    expect(v.root.querySelector('.vp-navlogin').tagName).toBe('SPAN');
  });
  it('the nav button scrolls to the form', () => {
    const v = render('site-lead');
    const form = v.root.querySelector('.vp-form');
    form.scrollIntoView = vi.fn();
    v.root.querySelector('.vp-navcta').click();
    expect(form.scrollIntoView).toHaveBeenCalled();
  });
});

describe('safety', () => {
  it.each(IDS)('%s renders hostile content as text only', (id) => {
    const cfg = defaultConfig(id);
    const evil = '<img src=x onerror=alert(1)><script>alert(1)</script>';
    cfg.headline = evil;
    cfg.site.hero.eyebrow = evil; cfg.site.hero.chip = evil; cfg.site.hero.bullets = [evil];
    cfg.site.band.title = evil;
    cfg.site.cards = cfg.site.cards.map((c) => ({ ...c, title: evil, text: evil, items: (c.items || []).map((i) => ({ ...i, title: evil, text: evil, by: evil })) }));
    cfg.site.strip.items = cfg.site.strip.items.map((i) => ({ ...i, title: evil }));
    const v = renderLandingPage({ page: page(cfg), tokens: { firstname: '<svg onload=alert(1)>' } });
    expect(v.root.querySelector('img[src="x"], script, [onerror], [onload]')).toBeNull();
    expect(v.root.querySelector('.vp-chip').textContent).toContain('<img');
  });
  it('sanitiseSite clips lengths, drops unknown card types, and ignores unknown icons', () => {
    const s = sanitizeSite({
      hero: { variant: 'nope', actions: 'nope', bullets: Array(9).fill('x'.repeat(500)) },
      nav: { links: Array(20).fill({ label: 'L', url: 'javascript:x' }) },
      strip: { kind: 'nope', items: [{ icon: 'not-an-icon', title: 'T' }] },
      cards: [{ type: 'script' }, { type: 'stats', w: 99, items: Array(30).fill({ title: 'a', value: 'b' }) }, { type: 'steps', w: -4 }],
    });
    expect(s.hero.variant).toBe('copy-video-form');
    expect(s.hero.actions).toBe('form');
    expect(s.hero.bullets).toHaveLength(5);
    expect(s.hero.bullets[0].length).toBe(120);
    expect(s.nav.links).toHaveLength(7);
    expect(s.nav.links[0].url).toBe('');
    expect(s.strip.kind).toBe('benefits');
    expect(s.strip.items[0].icon).toBe('');
    expect(s.cards.map((c) => c.type)).toEqual(['stats', 'steps']);
    expect(s.cards[0].w).toBe(12);
    expect(s.cards[0].items).toHaveLength(8);
    expect(s.cards[1].w).toBeGreaterThanOrEqual(2);
    expect(sanitizeSite(null).cards).toEqual([]);
  });
  it('a stored config without a site block still renders a site template', () => {
    const v = renderLandingPage({ page: page({ template: 'site-lead', headline: 'Hello' }), tokens: {} });
    expect(v.root.querySelector('.vp-sitenav')).not.toBeNull();
    expect(v.root.querySelector('video')).not.toBeNull();
  });
});

describe('switching templates', () => {
  it('switching to a site design takes its content, keeping the sender logo', () => {
    const cfg = defaultConfig('clean');
    cfg.theme.logoUrl = 'https://x.supabase.co/logo.png';
    const next = applyTemplate(cfg, 'site-reach');
    expect(next.template).toBe('site-reach');
    expect(next.site.cards.length).toBeGreaterThan(3);
    expect(next.theme.logoUrl).toBe('https://x.supabase.co/logo.png');
    expect(next.form.enabled).toBe(true);
  });
  it('older templates do not grow a site block', () => {
    expect(defaultConfig('clean').site).toBeUndefined();
    expect(defaultConfig('pitch').site).toBeUndefined();
  });
});

describe.each(SITE_TEMPLATES.map((t) => [t.name, t]))('%s: readability', (_n, t) => {
  const card = t.vars['--vp-surface'];
  it('body text is legible on the page and on its cards', () => {
    expect(contrastRatio(t.theme.text, t.theme.bg)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(t.theme.text, card)).toBeGreaterThanOrEqual(7);
  });
  it('muted text keeps 4.5:1 on the card', () => {
    const muted = t.vars['--vp-s-muted'];
    expect(contrastRatio(muted.startsWith('#') ? muted : blend(t.theme.text, card, 0.62), card)).toBeGreaterThanOrEqual(4.5);
  });
  it('button text is readable on the accent', () => {
    expect(contrastRatio(readableOn(t.theme.accent), t.theme.accent)).toBeGreaterThanOrEqual(4.5);
  });
});
