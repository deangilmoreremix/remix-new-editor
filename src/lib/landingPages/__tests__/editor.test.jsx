// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});
import { renderToString } from 'react-dom/server';
import { Render } from '@page-editor/core';
import { editorConfig } from '../editor/config.jsx';
import { PageContext } from '../editor/context.js';
import { EDITABLE_TEMPLATES } from '../editor/designs.js';
import { sanitizeEditorData, sanitizeConfig, defaultConfig } from '../templates.js';

const page = { id: 'abc12345', title: 'Intro', video_url: 'https://x.supabase.co/storage/v1/object/public/uploads/u/clip.mp4', poster_url: null };
const html = (data, tokens = {}) => renderToString(<PageContext.Provider value={{ page, tokens, handlers: {}, preview: false }}><Render config={editorConfig} data={data} /></PageContext.Provider>);
const starter = EDITABLE_TEMPLATES[0].editorData;

describe('editable pages', () => {
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
    Object.entries(editorConfig.components).forEach(([type, def]) => {
      const props = { id: `t-${type}`, ...def.defaultProps };
      // slots are filled by the editor itself, so a Grid is rendered empty here
      expect(() => html({ root: { props: {} }, content: [{ type, props }], zones: {} }), type).not.toThrow();
    });
  });
  it('all card types render inside a Grid slot', () => {
    const cards = editorConfig.categories.cards.components.map((type) => ({ type, props: { id: `c-${type}`, ...editorConfig.components[type].defaultProps } }));
    const out = html({ root: { props: {} }, content: [{ type: 'Grid', props: { id: 'g', columns: 3, items: cards } }], zones: {} });
    editorConfig.categories.cards.components.forEach((type) => expect(out).toContain('pk-card'));
    expect((out.match(/<article/g) || []).length).toBe(cards.length);
  });
  it('hostile text is escaped and unsafe links/images are dropped', () => {
    const evil = '<img src=x onerror=alert(1)><script>alert(1)</script>';
    const data = { root: { props: {} }, zones: {}, content: [
      { type: 'Hero', props: { id: 'h', ...editorConfig.components.Hero.defaultProps, headline: evil, subhead: evil, chip: evil, photo: 'javascript:alert(1)', buttons: [{ label: 'Bad', url: 'javascript:alert(1)', style: 'primary' }, { label: 'Good', url: 'https://ok.io', style: 'secondary' }] } },
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
    const data = { root: { props: {} }, zones: {}, content: [{ type: 'Hero', props: { id: 'h', ...editorConfig.components.Hero.defaultProps, buttons: [{ label: 'Jump', url: '#lead', style: 'primary' }, { label: 'Nope', url: '#lead"onclick="x', style: 'primary' }, { label: 'Js', url: 'javascript:alert(1)', style: 'primary' }] } }] };
    const out = html(data);
    expect(out).toContain('href="#lead"');
    expect(out).not.toContain('>Nope<');
    expect(out).not.toContain('>Js<');
  });
  it('form dropdowns render their choices as options, and form titles can highlight words', () => {
    const data = { root: { props: {} }, zones: {}, content: [{ type: 'Hero', props: { id: 'h', ...editorConfig.components.Hero.defaultProps, formTitle: 'Get your [[demo]]', formFields: [{ key: 'size', label: 'Team size', type: 'select', options: '1-10, 11-50, <b>51+</b>', required: true }] } }] };
    const out = html(data);
    expect(out).toContain('<select');
    expect(out).toContain('>11-50<');
    expect(out).toContain('&lt;b&gt;51+&lt;/b&gt;');
    expect(out).toContain('class="pk-accent"');
  });
  it('a hero background photo is set as a quoted CSS url, and unsafe values are ignored', () => {
    const hero = (background) => html({ root: { props: {} }, zones: {}, content: [{ type: 'Hero', props: { id: 'h', ...editorConfig.components.Hero.defaultProps, variant: 'story', background } }] });
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

describe('page data in the page config', () => {
  it('sanitizeEditorData bounds shape and size', () => {
    expect(sanitizeEditorData(null)).toBeNull();
    expect(sanitizeEditorData({ content: 'x' })).toBeNull();
    const clean = sanitizeEditorData({ content: [{ type: 'Hero', props: { id: 'a' } }, { nope: true }, ...Array(100).fill({ type: 'Footer', props: { id: 'f' } })], root: { props: { accent: '#fff' } } });
    expect(clean.content.length).toBeLessThanOrEqual(60);
    expect(clean.content.every((c) => typeof c.type === 'string')).toBe(true);
    expect(sanitizeEditorData({ content: [{ type: 'Hero', props: { id: 'a', big: 'x'.repeat(200000) } }] })).toBeNull();
  });
  it('an editable template creates a config with its page data, and old templates have none', () => {
    const cfg = defaultConfig('editable-starter');
    expect(cfg.editor.content.map((c) => c.type)).toEqual(['NavBar', 'Hero', 'Strip', 'Grid', 'Band', 'Footer']);
    expect(defaultConfig('clean').editor).toBeUndefined();
    expect(sanitizeConfig({ template: 'editable-starter' }).editor.content.length).toBeGreaterThan(0);
  });
});

describe.each(EDITABLE_TEMPLATES.map((t) => [t.name, t]))('design: %s', (_n, t) => {
  const out = html(t.editorData, { firstname: 'Maya', company: 'Brightline' });
  it('is a registered design with a class, theme and page data', () => {
    expect(t.id).toMatch(/^editable-/);
    expect(t.editable).toBe(true);
    expect(t.editorData.content.length).toBeGreaterThan(2);
    if (t.id !== 'editable-starter') {
      expect(t.designClass).toBeTruthy();
      expect(t.editorData.root.props.design).toBe(t.designClass);
      expect(editorConfig.root.fields.design.options.map((o) => o.value)).toContain(t.designClass);
    }
  });
  it('every component it uses exists in the config', () => {
    const types = (items) => items.flatMap((c) => [c.type, ...Object.values(c.props || {}).filter(Array.isArray).flatMap((a) => (a.length && a.every((x) => x && typeof x.type === 'string' && x.props && typeof x.props === 'object') ? types(a) : []))]);
    types(t.editorData.content).forEach((type) => expect(editorConfig.components[type], type).toBeDefined());
  });
  it('renders one h1, one video and a working lead form, with tokens filled', () => {
    expect((out.match(/<h1/g) || []).length).toBe(1);
    expect((out.match(/<video/g) || []).length).toBe(1);
    expect(out).toContain('pk-form');
    // Designs whose copy uses {{tokens}} must greet the contact; the supplied Results copy has none.
    if (JSON.stringify(t.editorData).includes('{{')) expect(out).toContain('Maya');
    expect(out).not.toMatch(/\{\{|\[\[/);
  });
  it('is flowing markup: no zoom, no fixed canvas, safe links only', () => {
    expect(out).not.toMatch(/is-canvas|zoom:|javascript:/i);
    expect(out).toContain(`pk-d-${t.designClass || 'clean'}`);
  });
  it('page data survives sanitising and stays well under the size limit', () => {
    const clean = sanitizeEditorData(t.editorData);
    expect(clean).not.toBeNull();
    expect(JSON.stringify(clean).length).toBeLessThan(100000);
  });
  it('the theme text is readable on the page background', () => {
    const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    expect(ratio(t.theme.text, t.theme.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('image fields offer the studio library', () => {
  it('every image-link field is a library-aware custom field and colour fields are not', () => {
    const isImgLabel = (l) => /image|photo|picture|logo|avatar/i.test(l || '') && !/#hex|colou?r/i.test(l || '');
    let custom = 0;
    for (const [name, c] of Object.entries(editorConfig.components)) {
      const all = Object.entries(c.fields || {}).flatMap(([k, f]) => (f?.type === 'array' ? Object.entries(f.arrayFields || {}) : [[k, f]]));
      for (const [k, f] of all) {
        if (f?.type === 'custom') custom += 1;
        if (f?.type === 'text') expect(isImgLabel(f.label), `${name}.${k} ${f.label}`).toBe(false);
      }
    }
    expect(custom).toBeGreaterThan(10);
  });
  it('only https non-video library entries are offered', async () => {
    const { isHttpsImage } = await import('../editor/ImageField.jsx');
    expect(isHttpsImage({ url: 'https://a.io/x.png', type: 'image' })).toBe(true);
    expect(isHttpsImage({ url: 'http://a.io/x.png', type: 'image' })).toBe(false);
    expect(isHttpsImage({ url: 'https://a.io/x.mp4', type: 'video' })).toBe(false);
    expect(isHttpsImage({ url: 'data:image/png;base64,AA', type: 'image' })).toBe(false);
  });
});

describe('heading and body font choices', () => {
  const withFonts = (props) => html({ root: { props: { design: 'clean', ...props } }, zones: {}, content: [{ type: 'TextBlock', props: { id: 't', title: 'Hello', text: 'World' } }] });
  it('a chosen font sets a CSS variable and a marker; no choice leaves the design font alone', () => {
    const out = withFonts({ headingFont: 'outfit', bodyFont: 'lora' });
    expect(out).toContain('--pk-fh:&quot;Outfit Variable&quot;');
    expect(out).toContain('--pk-fb:&quot;Lora Variable&quot;');
    expect(out).toContain('data-fh');
    expect(out).toContain('data-fb');
    const none = withFonts({});
    expect(none).not.toContain('data-fh');
    expect(none).not.toContain('--pk-fh');
  });
  it('unknown or hostile values are ignored (a page cannot inject CSS)', () => {
    const out = withFonts({ headingFont: 'x;}body{background:url(//evil)', bodyFont: '__proto__' });
    expect(out).not.toContain('evil');
    expect(out).not.toContain('--pk-fh');
    expect(out).not.toContain('--pk-fb');
  });
  it('every offered font has a stack and an import in the font stylesheet', async () => {
    const { FONT_OPTIONS, FONT_CSS } = await import('../editor/fontChoices.js');
    const css = (await import('node:fs')).readFileSync('styles/page-editor/00-fonts.css', 'utf8');
    FONT_OPTIONS.filter((o) => o.value).forEach((o) => {
      expect(FONT_CSS[o.value], o.value).toBeTruthy();
      const family = FONT_CSS[o.value].split(',')[0].replace(/"/g, '').replace(' Variable', '');
      const slug = family.toLowerCase().replace(/ /g, '-');
      expect(css.includes(`/${slug}/`) || css.includes(`${slug.replace('baloo-2', 'baloo-2')}`), `${o.value} (${slug}) is not imported`).toBe(true);
    });
  });
});

describe('#lead buttons on pages without a hero form', () => {
  it('scroll to the contact band, and never duplicate the lead id', async () => {
    const { createElement } = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const { LeadAnchorFallback } = await import('../editor/components.jsx');
    const host = document.createElement('div');
    host.innerHTML = '<a id="go" href="#lead">Go</a><section id="contact"></section>';
    document.body.appendChild(host);
    const scrolled = [];
    host.querySelector('#contact').scrollIntoView = () => scrolled.push('contact');
    const root = createRoot(document.createElement('div'));
    await act(async () => { root.render(createElement(LeadAnchorFallback)); });
    host.querySelector('#go').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(scrolled).toEqual(['contact']);
    // with a real #lead element the browser handles the link itself
    const lead = document.createElement('div'); lead.id = 'lead'; host.appendChild(lead);
    host.querySelector('#go').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(scrolled).toEqual(['contact']);
    expect(html(EDITABLE_TEMPLATES.find((t) => t.id === 'editable-pc-roofing').editorData).match(/id="lead"/g) || []).toHaveLength(0);
    await act(async () => { root.unmount(); });
    host.remove();
  });
});

describe('calendar weekday labels', () => {
  const card = (weekdays) => html({ root: { props: {} }, content: [{ type: 'ScheduleCard', props: { id: 'sc', columns: 1, title: 'Book', text: '', month: 'Mar', weekdays, days: '1,*2,3', time: '', buttonLabel: '' } }], zones: {} });
  const heads = (out) => { const d = document.createElement('div'); d.innerHTML = out; return [...d.querySelectorAll('.pk-cal-head span')].map((s) => s.textContent); };
  it('uses the labels when there are exactly seven', () => expect(heads(card('L, M, X, J, V, S, D'))).toEqual(['L', 'M', 'X', 'J', 'V', 'S', 'D']));
  it('falls back to the seven defaults for six or eight labels', () => {
    const defaults = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    expect(heads(card('a, b, c, d, e, f'))).toEqual(defaults);
    expect(heads(card('a, b, c, d, e, f, g, h'))).toEqual(defaults);
  });
});

describe('booking calendar (Cal.diy embed)', () => {
  const one = (props, preview = false) => renderToString(<PageContext.Provider value={{ page, tokens: {}, handlers: {}, preview }}><Render config={editorConfig} data={{ root: { props: {} }, content: [{ type: 'BookingCalendar', props: { id: 'b', title: 'Book', ...props } }], zones: {} }} /></PageContext.Provider>);
  it('inline: renders the #book section when a host and link are set', () => {
    const out = one({ mode: 'inline', host: 'https://book.example.com', link: 'pro/30min' });
    expect(out).toContain('id="book"');
    expect(out).toContain('pk-booking-embed');
  });
  it('renders nothing on the live page without a valid host and link, and a hint in the editor', () => {
    for (const mode of ['inline', 'popup']) {
      expect(one({ mode, host: '', link: 'pro/30min' })).not.toContain('id="book"');
      expect(one({ mode, host: 'javascript:alert(1)', link: 'pro/30min' })).not.toContain('id="book"');
      expect(one({ mode, host: 'http://evil.example.com', link: 'pro/30min' })).not.toContain('id="book"');
      expect(one({ mode, host: 'https://book.example.com', link: '../x?y' })).not.toContain('id="book"');
    }
    expect(one({ mode: 'inline', host: '', link: '' }, true)).toContain('Add your Cal.diy address');
    expect(one({ mode: 'popup', host: '', link: '' }, true)).toContain('Booking pop-up');
  });
  it('allows http only for localhost testing', () => {
    expect(one({ mode: 'inline', host: 'http://localhost:3000', link: 'pro/30min' })).toContain('id="book"');
  });
  it('popup (the default) draws nothing on the live page', () => {
    expect(one({ host: 'https://book.example.com', link: 'pro/30min' })).not.toContain('pk-booking');
  });
});

describe('booking pop-up opens from the page buttons', () => {
  it('opens the Cal modal for #book links and "Book ..." buttons that link to the form, and for nothing else', async () => {
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const calls = [];
    window.Cal = (...a) => calls.push(a);
    const box = document.createElement('div');
    document.body.appendChild(box);
    const mk = (href, text) => `<a class="pk-btn" href="${href}">${text}</a>`;
    box.innerHTML = `<div id="host"></div>${mk('#lead', 'Book a 15-Min Strategy Call')}${mk('#book', 'Pick a time')}${mk('#lead', 'Get My Demo')}${mk('https://x.example.com', 'Book now')}${mk('#lead', 'Schedule a Live Demo')}`;
    const root = createRoot(box.querySelector('#host'));
    await act(async () => { root.render(<PageContext.Provider value={{ page, tokens: {}, handlers: {}, preview: false }}><Render config={editorConfig} data={{ root: { props: {} }, content: [{ type: 'BookingCalendar', props: { id: 'b', mode: 'popup', host: 'https://book.example.com', link: 'pro/30min' } }], zones: {} }} /></PageContext.Provider>); });
    const links = [...box.querySelectorAll('a')];
    const clickAll = () => links.map((a) => { const ev = new MouseEvent('click', { bubbles: true, cancelable: true }); a.dispatchEvent(ev); return ev.defaultPrevented; });
    // Nothing is loaded from the booking server until a visitor reaches for a booking button.
    expect(calls).toHaveLength(0);
    const hover = (el) => el.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
    hover(links[2]); // "Get My Demo": not a booking button
    expect(calls.filter((c) => c[0] === 'preload')).toHaveLength(0);
    hover(links[0]); // "Book a 15-Min Strategy Call"
    hover(links[1]);
    expect(calls.filter((c) => c[0] === 'preload')).toHaveLength(1);
    expect(calls.filter((c) => c[0] === 'init')).toHaveLength(1);
    const prevented = clickAll();
    expect(prevented).toEqual([true, true, false, false, true]);
    const modals = calls.filter((c) => c[0] === 'modal');
    expect(modals).toHaveLength(3);
    expect(modals[0][1]).toMatchObject({ calLink: 'pro/30min', calOrigin: 'https://book.example.com' });
    await act(async () => { root.unmount(); });
    calls.length = 0;
    expect(clickAll()).toEqual([false, false, false, false, false]);
    expect(calls.filter((c) => c[0] === 'modal')).toHaveLength(0);
    delete window.Cal;
    box.remove();
  });
});

describe('booking defaults for the signed-in person', () => {
  it('a new Booking calendar section starts with their own Cal.diy address and booking link', async () => {
    const { mountPageEditor } = await import('../editor/mount.jsx');
    const box = document.createElement('div');
    document.body.appendChild(box);
    const handle = mountPageEditor(box, { page, data: { root: { props: {} }, content: [], zones: {} }, bookingDefaults: { host: 'https://book.example.com', link: 'u-2abc/30min' } });
    expect(editorConfig.components.BookingCalendar.defaultProps).toMatchObject({ host: 'https://book.example.com', link: 'u-2abc/30min', mode: 'popup' });
    handle.destroy();
    box.remove();
  });
  it('leaves the defaults alone when nobody is signed in', async () => {
    const { mountPageEditor } = await import('../editor/mount.jsx');
    editorConfig.components.BookingCalendar.defaultProps.host = '';
    editorConfig.components.BookingCalendar.defaultProps.link = '';
    const box = document.createElement('div');
    document.body.appendChild(box);
    const handle = mountPageEditor(box, { page, data: { root: { props: {} }, content: [], zones: {} }, bookingDefaults: null });
    expect(editorConfig.components.BookingCalendar.defaultProps).toMatchObject({ host: '', link: '' });
    handle.destroy();
    box.remove();
  });
});
