// @vitest-environment jsdom
// Reverse audit: everything a visitor SEES (text, alt text, placeholders, pictures) must come from an editor prop,
// so it can be edited in the editor. (The forward audit, newDesignsEditable, proves every prop has a field.)
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

const page = { id: 'abc12345', title: 'Intro', video_url: '', poster_url: null };
const html = (data) => renderToString(<PageContext.Provider value={{ page, tokens: {}, handlers: {}, preview: false }}><Render config={editorConfig} data={data} /></PageContext.Provider>);
const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
// Pure interface words that are not page content (screen-reader names for controls, video chrome).
const CHROME = new Set(['playvideo', 'site', 'email', 'loading', 'close', 'menu', 'search', 'videoplaceholderyourvideogoeshere'].map(norm));
// Screen-reader names built from the page title ("Picture for <title>"): not visible content.
// Also: star ratings, carousel arrows and landmark names are accessibility labels; bare numerals are automatic list counters.
const isChrome = (v) => CHROME.has(norm(v)) || /^picture for |out of 5 stars$|^(previous|next) testimonials$|^highlights$|^\d+$/i.test(String(v).trim());

function strings(node, out = []) {
  if (typeof node === 'string') out.push(node);
  else if (Array.isArray(node)) node.forEach((n) => strings(n, out));
  else if (node && typeof node === 'object') Object.values(node).forEach((n) => strings(n, out));
  return out;
}
const stripTokens = (s) => String(s).replace(/\{\{[^}|]*\|([^}]*)\}\}/g, '$1').replace(/\{\{[^}]*\}\}/g, '');

function offenders(t) {
  // Match against each prop value on its own, so text that is hard-coded cannot pass by straddling two props.
  const props = strings(t.editorData).map((s) => norm(stripTokens(s))).filter(Boolean);
  const known = { includes: (v) => props.some((s) => s.includes(v)) };
  const urls = strings(t.editorData).join(' ');
  const root = document.createElement('div'); root.innerHTML = html(t.editorData);
  const bad = [];
  const w = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const v = norm(n.nodeValue); if (!v || isChrome(n.nodeValue)) continue;
    if (!known.includes(v)) bad.push(`text: ${n.nodeValue.trim().slice(0, 60)}`);
  }
  root.querySelectorAll('[alt],[placeholder],[aria-label],[title]').forEach((el) => {
    ['alt', 'placeholder', 'aria-label', 'title'].forEach((a) => {
      const v = el.getAttribute(a); if (!v || !norm(v) || isChrome(v)) return;
      if (!known.includes(norm(v))) bad.push(`${a}: ${v.slice(0, 60)}`);
    });
  });
  root.querySelectorAll('img').forEach((el) => { if (!el.getAttribute('src')) bad.push('picture: <img> without a usable address'); });
  root.querySelectorAll('[style*="background-image"]').forEach((el) => {
    const m = /url\(['"]?([^'")]+)['"]?\)/.exec(el.getAttribute('style') || ''); if (m && !urls.includes(m[1])) bad.push(`background: ${m[1].slice(0, 80)}`);
  });
  root.querySelectorAll('img[src],source[src],video[poster]').forEach((el) => {
    const v = el.getAttribute('src') || el.getAttribute('poster'); if (v && !v.startsWith('data:') && !urls.includes(v)) bad.push(`picture: ${v.slice(0, 80)}`);
  });
  return [...new Set(bad)];
}

describe('every visible piece of content comes from an editable prop', () => {
  EDITABLE_TEMPLATES.forEach((t) => {
    it(t.id, () => { expect(offenders(t)).toEqual([]); });
  });
});

// ── Second audit: change a prop, the page must change ────────────────────────────────────────────────────────────
// The audit above shows nothing visible is hard-coded; this one shows every editable text and picture prop is actually
// USED: each is replaced by a unique value, the page is rendered again, and the value has to appear in the output.
// (A component that ignored `brand` and printed the same words itself would pass the first audit, not this one.)
const NOT_SHOWN = new Set([
  // field -> why changing it does not show on the page
  'ContactBand.fields.key', // the form field's internal name, not shown
  'LeadForm.fields.key',
  'Hero.formFields.key',
  'ContactBand.fields.options', // dropdown choices render inside an open dropdown only (checked separately by the form tests)
  'LeadForm.fields.options',
  'Hero.formFields.options',
]);
const isTextField = (f) => f && (f.type === 'text' || f.type === 'textarea');
const URLISH = /^(https?:\/\/|\/landing-art\/)/i;
// Link targets must be real addresses or the page (rightly) drops the link and its text.
const LINKISH_KEY = /url|href|link/i;
const NOT_PLAIN_TEXT = new Set([
  'ContactBand.successMessage', // shown only after the form is sent
  'LeadForm.successMessage',
  'ResultsTestimonials.quotes.stars', // a star count, drawn as stars
  'ReachStatsCard.items.icon', // icon names, drawn as icons
  'ReachFeaturesCard.items.icon',
  'MonoPanels.dashMenu.icon',
]);
const HIDDEN_FORM_KEY = /^(form|submitLabel$|privacy$)/;
// A prop the component legitimately does not show for the way THIS block is set up (the reason is spelled out for each).
function hiddenHere(item, key, row, parentKey) {
  const p = item.props;
  if (item.type === 'Hero' && p.showForm !== 'yes' && HIDDEN_FORM_KEY.test(parentKey || key)) return true; // hero form is switched off
  if (item.type === 'Showcase' && key === 'buttonUrl' && !p.buttonLabel) return true; // no button text = no button
  if (item.type === 'CtaBar' && key === 'url' && !p.text && Array.isArray(p.icons) && p.icons.length) return true; // social-icons bar has no main link
  if (item.type === 'TableCard' && key === 'title' && p.windowTitle) return true; // the window title replaces the card title
  if (item.type === 'PersonaResources' && key === 'buttonUrl' && row?.action === 'signup') return true; // a sign-up card shows an email box, not a link
  return false;
}
function probeValue(key, original, marker) {
  if (key === 'weekdays') return { value: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s) => marker + s).join(','), needle: marker };
  if (URLISH.test(original) || LINKISH_KEY.test(key)) return { value: `https://${marker}.example/p.png`, needle: `${marker}.example` };
  return { value: marker, needle: marker };
}

function mutate(templateData, config) {
  const data = JSON.parse(JSON.stringify(templateData));
  const probes = [];
  let n = 0;
  const visit = (item) => {
    const def = config.components[item?.type];
    if (!def || !item.props) return;
    Object.entries(item.props).forEach(([key, value]) => {
      const field = def.fields?.[key];
      if (!field) return;
      if (field.type === 'slot' && Array.isArray(value)) { value.forEach(visit); return; }
      if (field.type === 'array' && Array.isArray(value) && field.arrayFields) {
        value.forEach((row) => Object.entries(row || {}).forEach(([sub, sv]) => {
          if (typeof sv !== 'string' || !sv || !isTextField(field.arrayFields[sub])) return;
          const where = `${item.type}.${key}.${sub}`;
          if (NOT_PLAIN_TEXT.has(where) || hiddenHere(item, sub, row, key)) return;
          const pv = probeValue(sub, sv, `zq${n++}x`);
          row[sub] = pv.value;
          probes.push({ where, needle: pv.needle });
        }));
        return;
      }
      if (typeof value !== 'string' || !value || !isTextField(field)) return;
      const where = `${item.type}.${key}`;
      if (NOT_PLAIN_TEXT.has(where) || hiddenHere(item, key)) return;
      const pv = probeValue(key, value, `zq${n++}x`);
      item.props[key] = pv.value;
      probes.push({ where, needle: pv.needle });
    });
  };
  data.content.forEach(visit);
  return { data, probes };
}

describe('every editable text and picture prop is used by the page', () => {
  EDITABLE_TEMPLATES.forEach((t) => {
    it(t.id, () => {
      const { data, probes } = mutate(t.editorData, editorConfig);
      const out = html(data);
      const unused = probes.filter((p) => !NOT_SHOWN.has(p.where) && !out.includes(p.needle)).map((p) => p.where);
      expect([...new Set(unused)]).toEqual([]);
    });
  });
});
