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
import { sectionStyle } from '../editor/tokenFields.jsx';

const VIDEO = 'https://x.supabase.co/storage/v1/object/public/u/clip.mp4';
const page = { id: 'abc12345', title: 'Intro', video_url: VIDEO, poster_url: 'https://cdn.test/poster.jpg' };
const draw = (content, { preview = false, root = {} } = {}) => renderToString(
  <PageContext.Provider value={{ page, tokens: {}, handlers: {}, preview }}>
    <Render config={editorConfig} data={{ root: { props: root }, content }} />
  </PageContext.Provider>,
);
const hero = (props = {}) => ({ type: 'Hero', props: { id: 'h', ...editorConfig.components.Hero.defaultProps, ...props } });
const attr = (out, name) => (out.match(new RegExp(`${name}="([^"]*)"`)) || [])[1];

describe('video / picture viewer options', () => {
  it('defaults keep today\'s look: video with controls, wide, no autoplay, no loop, no caption', () => {
    const out = draw([hero()]);
    expect(out).toMatch(/\scontrols/); expect(out).not.toMatch(/\sautoplay/i); expect(out).not.toMatch(/\sloop/);
    expect(out).not.toContain('pk-video-caption'); expect(out).not.toContain('aspect-ratio');
  });
  it('"Still only" shows the picture and never plays the video', () => {
    const out = draw([hero({ viewerType: 'still' })]);
    expect(out).toContain('pk-video--still'); expect(out).not.toContain(VIDEO); expect(out).not.toMatch(/\scontrols/); expect(out).not.toContain('pk-video-play');
  });
  it('hide controls, loop, shape, caption and the screen-reader description', () => {
    const out = draw([hero({ viewerControls: 'no', viewerLoop: 'yes', viewerAspect: '1 / 1', viewerCaption: 'Made for {{firstname|you}}', viewerAlt: 'A tour of the office' })]);
    expect(out).not.toMatch(/\scontrols/); expect(out).toMatch(/\sloop/);
    expect(out).toContain('aspect-ratio:1 / 1');
    expect(out).toContain('pk-video-caption'); expect(out).toContain('Made for you');
    expect(attr(out, 'aria-label')).toBe('A tour of the office');
  });
  it('autoplay (muted) only on the live page, never in the editor preview', () => {
    const live = draw([hero({ viewerAutoplay: 'yes' })]); const edit = draw([hero({ viewerAutoplay: 'yes' })], { preview: true });
    expect(live).toMatch(/\sautoplay/i); expect(live).toMatch(/\smuted/); expect(edit).not.toMatch(/\sautoplay/i);
  });
  it('an unknown shape is ignored', () => { expect(draw([hero({ viewerAspect: 'expression(1)' })])).not.toContain('expression'); });
});

describe('nav, forms, outreach, buttons, alt text, footer', () => {
  const nav = (p) => ({ type: 'NavBar', props: { id: 'n', ...editorConfig.components.NavBar.defaultProps, ...p } });
  it('nav button goes to its own link, scrolls to the form by default, and the logo has alt text', () => {
    expect(draw([nav({})])).toContain('href="#lead"');
    const out = draw([nav({ ctaUrl: 'https://cal.test/book', logo: 'https://cdn.test/l.png', logoAlt: 'Acme mark' })]);
    expect(out).toContain('href="https://cal.test/book"'); expect(out).toContain('alt="Acme mark"');
    expect(draw([nav({ ctaUrl: 'javascript:alert(1)' })])).toContain('href="#lead"');
  });
  it('each form field can have its own placeholder; empty uses the label', () => {
    const out = draw([hero({ formFields: [{ key: 'name', label: 'Name', type: 'text', placeholder: 'Your full name' }, { key: 'email', label: 'Email', type: 'email' }] })]);
    expect(out).toContain('placeholder="Your full name"'); expect(out).toContain('placeholder="Email"');
  });
  it('the "could not send" message is a page setting with the same default', () => {
    expect(editorConfig.root.defaultProps.formError).toBe('Could not send. Please try again.');
    expect(editorConfig.root.fields.formError).toBeTruthy();
  });
  it('Like / Liked text and the sender photo description are editable', () => {
    const o = { type: 'OutreachActions', props: { id: 'o', ...editorConfig.components.OutreachActions.defaultProps, senderName: 'Sam', senderPhoto: 'https://cdn.test/s.png', senderPhotoAlt: 'Sam smiling', likeLabel: 'Love it' } };
    const out = draw([o]);
    expect(out).toContain('Love it'); expect(out).toContain('alt="Sam smiling"');
    expect(draw([{ ...o, props: { ...o.props, likeLabel: 'Like' } }])).toContain('Like');
  });
  it('a second button appears on the bar and on the showcase only when filled', () => {
    const bar = (p) => ({ type: 'CtaBar', props: { id: 'c', ...editorConfig.components.CtaBar.defaultProps, ...p } });
    expect(draw([bar({})])).not.toContain('pk-ctabar--second');
    expect(draw([bar({ label2: 'Call us', url2: 'tel:+15551234567' })])).toContain('Call us');
    const sc = (p) => ({ type: 'Showcase', props: { id: 's', ...editorConfig.components.Showcase.defaultProps, ...p } });
    expect(draw([sc({})])).not.toContain('Watch demo');
    expect(draw([sc({ button2Label: 'Watch demo', button2Url: 'https://x.test/demo' })])).toContain('Watch demo');
  });
  it('strip photo and testimonial face alt text', () => {
    const strip = { type: 'Strip', props: { id: 's', kind: 'benefits', title: '', items: [{ title: 'Fast', text: '', value: '', icon: '', image: 'https://cdn.test/a.png', alt: 'A rocket' }] } };
    expect(draw([strip])).toContain('alt="A rocket"');
    const grid = { type: 'Grid', props: { id: 'g', items: [{ type: 'QuoteCard', props: { id: 'q', columns: 1, heading: '', quotes: [{ text: 'Great', name: 'Ann', role: '', avatar: 'https://cdn.test/f.png', avatarAlt: 'Ann Lee' }] } }] } };
    expect(typeof editorConfig.components.QuoteCard.fields.quotes.arrayFields.avatarAlt).toBe('object');
    expect(draw([grid]).length).toBeGreaterThan(0);
  });
  it('footer: logo with description, and a row of social icons (unsafe links are dropped)', () => {
    const f = { type: 'Footer', props: { id: 'f', ...editorConfig.components.Footer.defaultProps, logo: 'https://cdn.test/f.png', logoAlt: 'Acme', social: [{ icon: 'facebook', url: 'https://fb.test/acme' }, { icon: 'facebook', url: 'javascript:alert(1)' }] } };
    const out = draw([f]);
    expect(out).toContain('pk-footer-logo'); expect(out).toContain('alt="Acme"');
    expect(out).toContain('href="https://fb.test/acme"'); expect(out).not.toContain('javascript:');
    expect(draw([{ ...f, props: { ...f.props, logo: '', social: [] } }])).not.toContain('pk-footer-social');
  });
});

describe('per-section colours and background', () => {
  const tb = (p) => ({ type: 'TextBlock', props: { id: 't', ...editorConfig.components.TextBlock.defaultProps, ...p } });
  it('nothing changes until one is set', () => { expect(draw([tb({})])).not.toContain('pk-sec'); });
  it('a section can have its own colours and background photo', () => {
    const out = draw([tb({ sectionBg: '#112233', sectionText: '#ffffff', sectionImage: 'https://cdn.test/bg.jpg' })]);
    expect(out).toContain('pk-sec'); expect(out).toContain('background:#112233'); expect(out).toContain('color:#ffffff'); expect(out).toContain('https://cdn.test/bg.jpg');
  });
  it('bad colours and unsafe pictures are rejected', () => {
    expect(sectionStyle({ sectionBg: 'red', sectionText: 'url(x)', sectionImage: 'javascript:alert(1)' })).toEqual({});
    expect(sectionStyle({ sectionImage: 'https://cdn.test/a"b.jpg' })).toEqual({});
    expect(draw([tb({ sectionBg: 'red' })])).not.toContain('pk-sec');
  });
  it('every section offers the three fields (the colour ones keep plain hex inputs)', () => {
    editorConfig.categories.sections.components.forEach((n) => {
      const f = editorConfig.components[n].fields;
      expect(f.sectionBg && f.sectionText && f.sectionImage, n).toBeTruthy();
      expect(f.sectionBg.type, `${n} colour is a plain input`).toBe('text');
    });
  });
});
