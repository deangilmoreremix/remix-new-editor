// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});
import { renderToString } from 'react-dom/server';
import { Render } from '@puckeditor/core';
import { puckConfig } from '../puck/config.jsx';
import { PageContext } from '../puck/context.js';
import { PUCK_TEMPLATES } from '../puck/designs.js';
import { sanitizePuck, sanitizeConfig, defaultConfig } from '../templates.js';

const page = { id: 'abc12345', title: 'Intro', video_url: 'https://x.supabase.co/storage/v1/object/public/uploads/u/clip.mp4', poster_url: null };
const html = (data, tokens = {}) => renderToString(<PageContext.Provider value={{ page, tokens, handlers: {}, preview: false }}><Render config={puckConfig} data={data} /></PageContext.Provider>);
const starter = PUCK_TEMPLATES[0].puckData;

describe('editable (Puck) pages', () => {
  it('the starter renders every section with one h1, one video and the lead form', () => {
    const out = html(starter, { firstname: 'Maya', company: 'Brightline' });
    expect((out.match(/<h1/g) || []).length).toBe(1);
    expect((out.match(/<video/g) || []).length).toBe(1);
    expect(out).toContain('pk-form');
    expect(out).toContain('pk-nav');
    expect(out).toContain('pk-grid');
    expect(out).toContain('pk-footer');
    expect(out).toContain('Maya');
    expect(out).not.toMatch(/\{\{|\[\[/);
  });
  it('falls back when no contact is known', () => {
    expect(html(starter)).toContain('Hi there');
  });
  it('every component in the config renders from its default props without throwing', () => {
    Object.entries(puckConfig.components).forEach(([type, def]) => {
      const props = { id: `t-${type}`, ...def.defaultProps };
      // slots are filled by Puck itself, so a Grid is rendered empty here
      expect(() => html({ root: { props: {} }, content: [{ type, props }], zones: {} }), type).not.toThrow();
    });
  });
  it('all card types render inside a Grid slot', () => {
    const cards = puckConfig.categories.cards.components.map((type) => ({ type, props: { id: `c-${type}`, ...puckConfig.components[type].defaultProps } }));
    const out = html({ root: { props: {} }, content: [{ type: 'Grid', props: { id: 'g', columns: 3, items: cards } }], zones: {} });
    puckConfig.categories.cards.components.forEach((type) => expect(out).toContain('pk-card'));
    expect((out.match(/<article/g) || []).length).toBe(cards.length);
  });
  it('hostile text is escaped and unsafe links/images are dropped', () => {
    const evil = '<img src=x onerror=alert(1)><script>alert(1)</script>';
    const data = { root: { props: {} }, zones: {}, content: [
      { type: 'Hero', props: { id: 'h', ...puckConfig.components.Hero.defaultProps, headline: evil, subhead: evil, chip: evil, photo: 'javascript:alert(1)', buttons: [{ label: 'Bad', url: 'javascript:alert(1)', style: 'primary' }, { label: 'Good', url: 'https://ok.io', style: 'secondary' }] } },
      { type: 'NavBar', props: { id: 'n', brand: evil, logo: 'javascript:alert(2)', links: [{ label: 'Bad', url: 'javascript:alert(3)' }], loginLabel: evil, loginUrl: 'javascript:alert(4)', ctaLabel: '' } },
      { type: 'Footer', props: { id: 'f', text: evil, links: [{ label: 'Bad', url: 'javascript:alert(5)' }] } },
    ] };
    const out = html(data, { firstname: '<svg onload=alert(1)>' });
    expect(out).not.toMatch(/<script|<img[^>]*onerror|<svg[^>]*onload|\sonerror="|href="javascript:|src="javascript:/i);
    expect(out).toContain('&lt;img');
    expect(out).toContain('href="https://ok.io"');
    expect(out).not.toContain('>Bad</a>');
  });
  it('in-page anchors work as button links, other unsafe links do not', () => {
    const data = { root: { props: {} }, zones: {}, content: [{ type: 'Hero', props: { id: 'h', ...puckConfig.components.Hero.defaultProps, buttons: [{ label: 'Jump', url: '#lead', style: 'primary' }, { label: 'Nope', url: '#lead"onclick="x', style: 'primary' }, { label: 'Js', url: 'javascript:alert(1)', style: 'primary' }] } }] };
    const out = html(data);
    expect(out).toContain('href="#lead"');
    expect(out).not.toContain('>Nope<');
    expect(out).not.toContain('>Js<');
  });
  it('form dropdowns render their choices as options, and form titles can highlight words', () => {
    const data = { root: { props: {} }, zones: {}, content: [{ type: 'Hero', props: { id: 'h', ...puckConfig.components.Hero.defaultProps, formTitle: 'Get your [[demo]]', formFields: [{ key: 'size', label: 'Team size', type: 'select', options: '1-10, 11-50, <b>51+</b>', required: true }] } }] };
    const out = html(data);
    expect(out).toContain('<select');
    expect(out).toContain('>11-50<');
    expect(out).toContain('&lt;b&gt;51+&lt;/b&gt;');
    expect(out).toContain('class="pk-accent"');
  });
  it('a hero background photo is set as a quoted CSS url, and unsafe values are ignored', () => {
    const hero = (background) => html({ root: { props: {} }, zones: {}, content: [{ type: 'Hero', props: { id: 'h', ...puckConfig.components.Hero.defaultProps, variant: 'story', background } }] });
    expect(hero('https://cdn.example.com/a.jpg')).toContain('--pk-hero-bg');
    expect(hero('/landing-art/11/hero.webp')).toContain('--pk-hero-bg');
    expect(hero('javascript:alert(1)')).not.toContain('--pk-hero-bg');
    expect(hero('https://x.io/a.jpg\");background:url(javascript:alert(1)')).not.toMatch(/javascript:alert/);
  });
  it('the bottom button bar links safely', () => {
    const bar = (url) => html({ root: { props: {} }, zones: {}, content: [{ type: 'CtaBar', props: { id: 'b', label: 'Go', url, icon: 'calendar' } }] });
    expect(bar('https://ok.io')).toContain('href="https://ok.io"');
    expect(bar('#lead')).toContain('href="#lead"');
    expect(bar('javascript:alert(1)')).toContain('href="#lead"');
  });
  it('the bar shows social icons with safe links only', () => {
    const bar = (icons) => html({ root: { props: {} }, zones: {}, content: [{ type: 'CtaBar', props: { id: 'b', label: 'Follow Us', url: '#lead', icons } }] });
    const out = bar([{ icon: 'facebook', url: 'https://facebook.com/x' }, { icon: 'instagram', url: 'javascript:alert(1)' }, { icon: 'nope', url: 'https://a.io' }]);
    expect(out).toContain('href="https://facebook.com/x"');
    expect(out).not.toContain('javascript:');
    expect(out.match(/pk-ctabar-social/g)).toHaveLength(1);
  });
  it('the phone and desktop markup is the same responsive markup (no fixed canvas)', () => {
    const out = html(starter);
    expect(out).not.toMatch(/is-canvas|zoom:/);
  });
});

describe('Puck data in the page config', () => {
  it('sanitizePuck bounds shape and size', () => {
    expect(sanitizePuck(null)).toBeNull();
    expect(sanitizePuck({ content: 'x' })).toBeNull();
    const clean = sanitizePuck({ content: [{ type: 'Hero', props: { id: 'a' } }, { nope: true }, ...Array(100).fill({ type: 'Footer', props: { id: 'f' } })], root: { props: { accent: '#fff' } } });
    expect(clean.content.length).toBeLessThanOrEqual(60);
    expect(clean.content.every((c) => typeof c.type === 'string')).toBe(true);
    expect(sanitizePuck({ content: [{ type: 'Hero', props: { id: 'a', big: 'x'.repeat(200000) } }] })).toBeNull();
  });
  it('a puck template creates a config with its page data, and old templates have none', () => {
    const cfg = defaultConfig('puck-starter');
    expect(cfg.puck.content.map((c) => c.type)).toEqual(['NavBar', 'Hero', 'Strip', 'Grid', 'Band', 'Footer']);
    expect(defaultConfig('clean').puck).toBeUndefined();
    expect(sanitizeConfig({ template: 'puck-starter' }).puck.content.length).toBeGreaterThan(0);
  });
});

describe.each(PUCK_TEMPLATES.map((t) => [t.name, t]))('design: %s', (_n, t) => {
  const out = html(t.puckData, { firstname: 'Maya', company: 'Brightline' });
  it('is a registered design with a class, theme and page data', () => {
    expect(t.id).toMatch(/^puck-/);
    expect(t.puck).toBe(true);
    expect(t.puckData.content.length).toBeGreaterThan(2);
    if (t.id !== 'puck-starter') {
      expect(t.designClass).toBeTruthy();
      expect(t.puckData.root.props.design).toBe(t.designClass);
      expect(puckConfig.root.fields.design.options.map((o) => o.value)).toContain(t.designClass);
    }
  });
  it('every component it uses exists in the config', () => {
    const types = (items) => items.flatMap((c) => [c.type, ...Object.values(c.props || {}).filter(Array.isArray).flatMap((a) => (a.length && a.every((x) => x && typeof x.type === 'string' && x.props && typeof x.props === 'object') ? types(a) : []))]);
    types(t.puckData.content).forEach((type) => expect(puckConfig.components[type], type).toBeDefined());
  });
  it('renders one h1, one video and a working lead form, with tokens filled', () => {
    expect((out.match(/<h1/g) || []).length).toBe(1);
    expect((out.match(/<video/g) || []).length).toBe(1);
    expect(out).toContain('pk-form');
    // Designs whose copy uses {{tokens}} must greet the contact; the supplied Results copy has none.
    if (JSON.stringify(t.puckData).includes('{{')) expect(out).toContain('Maya');
    expect(out).not.toMatch(/\{\{|\[\[/);
  });
  it('is flowing markup: no zoom, no fixed canvas, safe links only', () => {
    expect(out).not.toMatch(/is-canvas|zoom:|javascript:/i);
    expect(out).toContain(`pk-d-${t.designClass || 'clean'}`);
  });
  it('page data survives sanitising and stays well under the size limit', () => {
    const clean = sanitizePuck(t.puckData);
    expect(clean).not.toBeNull();
    expect(JSON.stringify(clean).length).toBeLessThan(100000);
  });
  it('the theme text is readable on the page background', () => {
    const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    expect(ratio(t.theme.text, t.theme.bg)).toBeGreaterThanOrEqual(4.5);
  });
});
