// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});
import { renderToString } from 'react-dom/server';
import { Render } from '@page-editor/core';
import { editorConfig } from '../editor/config.jsx';
import { PageContext } from '../editor/context.js';
import { VideoPlayer } from '../editor/components.jsx';
import { insertToken, tokenText, fillPropTokens, accentOverride, withTokenPickers } from '../editor/tokenFields.jsx';
import { fillUrlTokens, tokensFromQuery, tokensUsed, PUBLIC_TOKEN_KEYS, TOKEN_CHOICES } from '../templates.js';
import { customerTokens, normalizeCustomer } from '../customerProfile.js';

const page = { id: 'abc12345', title: 'Intro', video_url: 'https://x.supabase.co/storage/v1/object/public/u/clip.mp4', poster_url: null };
const withCtx = (tokens, node) => renderToString(<PageContext.Provider value={{ page, tokens, handlers: {}, preview: false }}>{node}</PageContext.Provider>);

describe('tokens in links and pictures', () => {
  it('fills a whole-URL token as is and URL-encodes the rest', () => {
    const t = { company: 'Acme & Sons', website: 'https://acme.test/hi', firstname: 'Ann Lee' };
    expect(fillUrlTokens('{{website}}', t)).toBe('https://acme.test/hi');
    expect(fillUrlTokens('https://cal.test/book?c={{company}}&n={{firstname|there}}', t)).toBe('https://cal.test/book?c=Acme%20%26%20Sons&n=Ann%20Lee');
    expect(fillUrlTokens('https://cal.test/?n={{firstname|there}}', {})).toBe('https://cal.test/?n=there');
  });

  it('a button link and a picture on the page are filled from the contact', () => {
    const data = { root: { props: {} }, content: [
      { type: 'PageImage', props: { id: 'i1', src: '{{image}}', alt: 'Hello {{firstname}}', rounded: 'yes' } },
      { type: 'Showcase', props: { id: 's1', variant: 'split', side: 'right', title: 'Hi', text: 'x', bullets: [], buttonLabel: 'Book', buttonUrl: '{{cta}}', image: '', imageAlt: '' } },
    ] };
    const out = withCtx({ image: 'https://cdn.test/ann.png', cta: 'https://cal.test/ann', firstname: 'Ann' }, <Render config={editorConfig} data={data} />);
    expect(out).toContain('src="https://cdn.test/ann.png"');
    expect(out).toContain('href="https://cal.test/ann"');
    const none = withCtx({}, <Render config={editorConfig} data={data} />);
    expect(none).not.toContain('{{');
    expect(none).not.toContain('href="https://cal.test/ann"');
  });

  it('a contact\'s own video and picture beat the page default in the viewer', () => {
    const own = withCtx({ video: 'https://cdn.test/ann.mp4', image: 'https://cdn.test/ann.png' }, <VideoPlayer />);
    expect(own).toContain('src="https://cdn.test/ann.mp4"');
    expect(own).toContain('poster="https://cdn.test/ann.png"');
    const def = withCtx({}, <VideoPlayer />);
    expect(def).toContain(page.video_url);
  });

  it('a contact\'s brand colour replaces the accent; a bad colour is ignored', () => {
    expect(accentOverride('#ff0000')['--pk-accent']).toBe('#ff0000');
    expect(accentOverride('red')).toEqual({});
    const out = withCtx({ accent: '#00aa55' }, <Render config={editorConfig} data={{ root: { props: { accent: '#2563eb' } }, content: [] }} />);
    expect(out).toContain('--pk-accent:#00aa55');
  });
});

describe('safety: address-bar tokens', () => {
  it('links, pictures, videos and colours never come from the page address', () => {
    const q = tokensFromQuery('?firstname=Ann&cta=https://evil.test&website=https://evil.test&image=https://evil.test/x.png&video=https://evil.test/v.mp4&accent=%23ff0000&companylogo=https://evil.test/l.png');
    expect(q).toEqual({ firstname: 'Ann' });
  });
  it('the contact row can carry the new keys', () => {
    ['website', 'phone', 'offer', 'cta', 'industry', 'accent', 'image', 'video'].forEach((k) => expect(PUBLIC_TOKEN_KEYS).toContain(k));
  });
});

describe('insert field', () => {
  it('inserts at the cursor, replaces a selection, or appends', () => {
    expect(insertToken('Hi , welcome', '{{firstname}}', 3, 3)).toEqual({ value: 'Hi {{firstname}}, welcome', caret: 16 });
    expect(insertToken('Hi NAME!', '{{firstname}}', 3, 7).value).toBe('Hi {{firstname}}!');
    expect(insertToken('Hello', '{{company}}').value).toBe('Hello{{company}}');
  });
  it('writes a fallback where one makes sense', () => {
    expect(tokenText(TOKEN_CHOICES.find((c) => c[0] === 'firstname'))).toBe('{{firstname|there}}');
    expect(tokenText(TOKEN_CHOICES.find((c) => c[0] === 'city'))).toBe('{{city}}');
  });
  it('every text and long-text field in the editor, including lists, gets the Insert field menu (colour and field-name boxes keep plain inputs)', () => {
    const plain = [];
    for (const [name, comp] of Object.entries(editorConfig.components)) {
      for (const [k, f] of Object.entries(comp.fields || {})) {
        if (f?.type === 'text' || f?.type === 'textarea') plain.push(`${name}.${k}:${f.label}`);
        if (f?.type === 'array') for (const [ak, af] of Object.entries(f.arrayFields || {})) if (af?.type === 'text' || af?.type === 'textarea') plain.push(`${name}.${k}.${ak}:${af.label}`);
      }
    }
    expect(plain.filter((s) => !/#hex|colou?r|field name|\(a-z\)/i.test(s))).toEqual([]);
  });
  it('withTokenPickers leaves select and radio fields alone', () => {
    const comps = { X: { fields: { a: { type: 'text', label: 'Title' }, b: { type: 'select', label: 'Pick', options: [] } } } };
    withTokenPickers(comps);
    expect(comps.X.fields.a.type).toBe('custom');
    expect(comps.X.fields.b.type).toBe('select');
  });
});

describe('fillPropTokens', () => {
  it('fills only link / picture props (and sender text), deep, and never mutates', () => {
    const props = { title: 'Hi {{firstname}}', buttons: [{ label: 'Go', url: '{{cta}}' }], senderName: '{{firstname|Sam}}', senderPhoto: '{{image}}' };
    const out = fillPropTokens(props, { firstname: 'Ann', cta: 'https://x.test/a', image: 'https://x.test/i.png' });
    expect(out.title).toBe('Hi {{firstname}}');   // text goes through the component's own token filler
    expect(out.buttons[0].url).toBe('https://x.test/a');
    expect(out.senderName).toBe('Ann');
    expect(out.senderPhoto).toBe('https://x.test/i.png');
    expect(props.buttons[0].url).toBe('{{cta}}');
  });
});

describe('tokens in use, and a customer\'s extras', () => {
  it('lists tokens found anywhere in a Puck page', () => {
    const cfg = { template: 'editable-leadiq', editor: { root: { props: {} }, content: [{ type: 'PageImage', props: { src: '{{image}}', alt: '{{firstname}}' } }] } };
    expect(tokensUsed(cfg)).toEqual(expect.arrayContaining(['image', 'firstname']));
  });
  it('a customer carries website, phone, offer, button link, industry, colour, picture and video as tokens', () => {
    const c = normalizeCustomer({ id: 'l1', business: { name: 'Acme', category: 'Plumbing', city: 'Reno', phone: '775 555 0199', website: 'https://acme.test', email: 'a@acme.test' } }, 'lead');
    c.brand.accent = '#112233'; c.image = 'https://cdn.test/a.png'; c.video = 'https://cdn.test/a.mp4'; c.business.cta = 'https://cal.test/acme'; c.business.offer = '10% off';
    const t = customerTokens(c);
    expect(t).toMatchObject({ website: 'https://acme.test', offer: '10% off', accent: '#112233', image: 'https://cdn.test/a.png', video: 'https://cdn.test/a.mp4', cta: 'https://cal.test/acme' });
    expect(t.phone).toMatch(/555/);
  });
});
