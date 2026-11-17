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
