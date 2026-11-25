// @vitest-environment jsdom
// Personalization must work on EVERY landing page design: a contact's name shows up, and a customer's brand
// (name, logo, colour, picture) lands on the page. One rule set, run over all designs.
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
import { normalizeCustomer, customerTokens, applyCustomerToEditor } from '../customerProfile.js';

const CUSTOMER = {
  ...normalizeCustomer({ id: 'c1', name: 'Dana Whitfield', businessName: 'Riverside Plumbing', industry: 'Plumbing', location: 'Austin, TX', phone: '(512) 555-0142', website: 'https://riversideplumbing.com' }, 'client', { assets: { primaryLogo: { url: 'blob:x', uploadedUrl: 'https://cdn.test/riverside-logo.png' } }, brandColors: { primary: '#12ab34' } }),
  image: 'https://cdn.test/riverside-personal.png',
};
const TOKENS = customerTokens(CUSTOMER);
const page = { id: 'abc12345', title: 'Intro', video_url: '', poster_url: null };
const render = (data, tokens = {}) => renderToString(<PageContext.Provider value={{ page, tokens, handlers: {}, preview: false }}><Render config={editorConfig} data={data} /></PageContext.Provider>);
// What a visitor reads: tags and attributes (form values, alt text) removed.
const readable = (out) => out.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const hasProp = (data, key) => JSON.stringify(data).includes(`"${key}":`);

// A design that genuinely has no such spot says why here (rule -> design id -> reason). Keep this list short.
const WAIVED = {
  logo: {},
  image: {},
  businessName: {},
};

describe('personalization works on every design', () => {
  EDITABLE_TEMPLATES.forEach((t) => {
    describe(t.id, () => {
      it('shows the contact\'s first name when a personal link is opened', () => {
        const text = readable(render(t.editorData, TOKENS));
        expect(text.includes('Dana') || text.includes('Austin')).toBe(true); // name, or the city for the designs that greet by city
      });
      it('leaves no raw token behind, with or without a contact', () => {
        expect(render(t.editorData, TOKENS)).not.toMatch(/\{\{|\[\[/);
        expect(render(t.editorData, {})).not.toMatch(/\{\{|\[\[/);
      });
      it('without a contact nothing reads like a broken greeting', () => {
        const out = readable(render(t.editorData, {}));
        const broken = /\b(Hi|Hello|Hey)(\s+|,\s*)[,!.]|\bfor\s+(at\b|[!,.])/i.exec(out);
        expect(broken ? out.slice(Math.max(0, broken.index - 30), broken.index + 50) : '').toBe('');
      });
      it('writes the customer\'s brand into the page', () => {
        const { data } = applyCustomerToEditor(t.editorData, CUSTOMER, { useImage: true });
        const out = render(data, TOKENS);
        expect(data.root.props.accent).toBe('#12ab34');
        if (!WAIVED.businessName[t.id]) expect(out).toContain('Riverside Plumbing');
        if (hasProp(t.editorData, 'logo') && !WAIVED.logo[t.id]) expect(out).toContain('riverside-logo.png');
        if (!WAIVED.image[t.id]) expect(out).toContain('riverside-personal.png');
      });
      it('changes only personal spots', () => {
        const { data } = applyCustomerToEditor(t.editorData, CUSTOMER, { useImage: true });
        expect(data.content.map((c) => c.type)).toEqual(t.editorData.content.map((c) => c.type));
      });
    });
  });
});
