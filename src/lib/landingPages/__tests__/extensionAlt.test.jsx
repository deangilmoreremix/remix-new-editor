// @vitest-environment jsdom
// Audit of the design-specific components (editor/extensions): every picture that carries meaning has an alt-text field,
// and every other empty alt is a known decorative picture. A new design cannot add an undescribed content picture unnoticed.
import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
});
import { renderToString } from 'react-dom/server';
import { Render } from '@page-editor/core';
import { editorConfig } from '../editor/config.jsx';
import { PageContext } from '../editor/context.js';

const page = { id: 'abc12345', title: 'Intro', video_url: '', poster_url: null };
const draw = (type, props) => renderToString(
  <PageContext.Provider value={{ page, tokens: {}, handlers: {}, preview: false }}>
    <Render config={editorConfig} data={{ root: { props: {} }, content: [{ type, props: { id: 'x', ...props } }] }} />
  </PageContext.Provider>,
);
const isAltKey = (k) => /alt$/i.test(k);
/** Props with every alt-text field (top level and inside lists) filled in. */
function withAlts(comp) {
  const props = JSON.parse(JSON.stringify(comp.defaultProps || {}));
  for (const [k, f] of Object.entries(comp.fields || {})) {
    if (isAltKey(k)) props[k] = 'ALT';
    if (f?.type === 'array' && Array.isArray(props[k])) {
      const altKeys = Object.keys(f.arrayFields || {}).filter(isAltKey);
      props[k] = props[k].map((it) => ({ ...it, ...Object.fromEntries(altKeys.map((a) => [a, 'ALT'])) }));
    }
  }
  return props;
}
/** Give every picture-like prop (photo, avatar, image...) a real https picture so there is something to describe. */
const withPics = (v, key = '') => {
  if (Array.isArray(v)) return v.map((x) => withPics(x, key));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, withPics(x, k)]));
  return /^(photo|avatar|image)$/.test(key) ? 'https://cdn.test/pic.png' : v;
};
const emptyAltImgs = (html) => (html.match(/<img\b[^>]*>/g) || []).filter((t) => /\salt=""/.test(t) && !/aria-hidden="true"/.test(t));

// Pictures that sit beside their own text (a logo next to its name, an icon next to its label, a face next to the caption):
// the text already says it, so an empty alt is correct.
const DECORATIVE_ONLY = new Set([
  'PersonaSteps', 'MonoProof', 'MonoIntro', 'MonoPanels', 'PosterNav', 'PosterLogos', 'PosterProof', 'PosterFeatures',
  'LocalIndustries', 'LocalFlowCard', 'ResultsFeatures', 'ResultsTestimonials', 'RealtorNav', 'DreamhomeFeatures', 'NeonHero', 'LeadLogoStrip',
]);
const EXT = editorConfig.categories.extras.components;

describe('extension components: picture descriptions', () => {
  it('every extension component renders with its alt fields filled', () => {
    for (const name of EXT) expect(() => draw(name, withAlts(editorConfig.components[name])), name).not.toThrow();
  });

  it('with every alt field filled, an empty alt is left only on decorative pictures', () => {
    const offenders = EXT.filter((name) => !DECORATIVE_ONLY.has(name) && emptyAltImgs(draw(name, withAlts(editorConfig.components[name]))).length);
    expect(offenders).toEqual([]);
  });

  it('the described pictures use exactly the text the user typed', () => {
    for (const name of ['LeadiqTestimonials', 'PersonaTestimonials', 'PersonaResources', 'EnterpriseTestimonials', 'DreamhomeProof', 'DreamhomeCta', 'ReachQuotesCard']) {
      const comp = editorConfig.components[name];
      const props = withPics(withAlts(comp));
      // a list with no items yet has nothing to describe: make sure each list has one
      for (const [k, f] of Object.entries(comp.fields)) if (f?.type === 'array' && Array.isArray(props[k]) && !props[k].length) props[k] = [withPics({ ...Object.fromEntries(Object.keys(f.arrayFields || {}).map((a) => [a, isAltKey(a) ? 'ALT' : 'x'])) })];
      const html = draw(name, props);
      expect(html, name).toContain('alt="ALT"');
    }
  });

  it('the detector works: undescribed content pictures are flagged, described ones are not', () => {
    const comp = editorConfig.components.DreamhomeProof;
    expect(emptyAltImgs(draw('DreamhomeProof', withPics(comp.defaultProps))).length).toBeGreaterThan(0);
    expect(emptyAltImgs(draw('DreamhomeProof', withPics(withAlts(comp)))).length).toBe(0);
  });

  it('with no alt typed, the output is the same as before (empty alt)', () => {
    const html = draw('DreamhomeProof', editorConfig.components.DreamhomeProof.defaultProps);
    expect(html).toContain('alt=""'); expect(html).not.toContain('alt="ALT"');
  });

  it('screen-reader names of sections and carousel arrows are editable, with today\'s text as the default', () => {
    expect(draw('LocalIndustries', editorConfig.components.LocalIndustries.defaultProps)).toContain('aria-label="Industries"');
    expect(draw('LocalIndustries', { ...editorConfig.components.LocalIndustries.defaultProps, sectionName: 'Trades we serve' })).toContain('aria-label="Trades we serve"');
    expect(draw('DreamhomeFeatures', editorConfig.components.DreamhomeFeatures.defaultProps)).toContain('aria-label="Features"');
    expect(draw('NeonHero', { ...editorConfig.components.NeonHero.defaultProps, highlightsLabel: 'Key numbers' })).toContain('aria-label="Key numbers"');
    const q = editorConfig.components.ReachQuotesCard.defaultProps;
    expect(draw('ReachQuotesCard', q)).toContain('aria-label="Previous testimonials"');
    expect(draw('ReachQuotesCard', { ...q, prevLabel: 'Back', nextLabel: 'Forward' })).toMatch(/aria-label="Back"[\s\S]*aria-label="Forward"/);
  });

  it('every design-specific section (not the *Card ones) has its own colour and background fields', () => {
    for (const name of EXT.filter((n) => !/Card$/.test(n))) {
      const f = editorConfig.components[name].fields;
      expect(f.sectionBg && f.sectionText && f.sectionImage, name).toBeTruthy();
    }
  });
});
