// Ask SmartVideo — pure helpers for the panel (no DOM, unit-testable).
import { getStudioLabel, getNavItemForRoute } from '../../lib/studioRoutes.js';
import { STUDIO_ACADEMY, TRACK_TITLES } from '../../data/askAcademyMap.js';
import JOURNEYS from '../../data/askJourneyList.json';

export const ENDPOINT = '/api/ask-smartvideo';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Page id a source link points at ('#/edit' → 'edit'). */
export const pageOf = (url) => String(url || '').replace(/^#\/?/, '').split('?')[0] || 'apps';
/** Academy links are hash *paths* handled by the Academy page itself, not router page ids. */
export const isAcademyUrl = (url) => /^#\/academy(\/|$)/.test(String(url || ''));

/**
 * Safe mini-Markdown → HTML. Everything is HTML-escaped first, then only a
 * fixed set of constructs is re-introduced (bold, inline code, lists,
 * paragraphs, [S#] citations). Model output can never inject markup or links.
 */
export function renderAnswer(text, sources = []) {
  const cite = (s) => s.replace(/\[S(\d+)\]/g, (m, n) => {
    const src = sources[Number(n) - 1];
    return src ? `<a href="${esc(src.url)}" data-ask-url="${esc(src.url)}" class="ask-cite">${n}</a>` : '';
  });
  const inline = (s) => cite(esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>'));
  const out = [];
  let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    const ol = line.match(/^\d+[.)]\s+(.*)/);
    const ul = line.match(/^[-*•]\s+(.*)/);
    if (ol || ul) {
      const tag = ol ? 'ol' : 'ul';
      if (list !== tag) { close(); out.push(`<${tag}>`); list = tag; }
      out.push(`<li>${inline((ol || ul)[1])}</li>`);
    } else if (!line) {
      close();
    } else {
      close();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  close();
  return out.join('');
}

/** Split an SSE buffer into complete events; returns the unconsumed remainder. */
export function parseSSE(buffer) {
  const events = [];
  const parts = buffer.split('\n\n');
  const rest = parts.pop();
  for (const block of parts) {
    let event = 'message';
    let data = '';
    for (const l of block.split('\n')) {
      if (l.startsWith('event:')) event = l.slice(6).trim();
      else if (l.startsWith('data:')) data += l.slice(5).trim();
    }
    if (!data) continue;
    try { events.push({ event, data: JSON.parse(data) }); } catch { /* skip malformed event */ }
  }
  return { events, rest };
}

// Pages that belong to a studio's guide without being a side-menu item or having the studio's own id.
const GUIDE_ALIASES = { 'timeline-classic': 'timeline', openthorn: 'website-builder' };

/**
 * Which studio guide applies to the page the user is on. The side menu knows most studios, but
 * some real pages (Influencer, Motion Director, Lead Finder, Find My Brand, Render, ...) are not
 * menu items, so fall back to any studio that has a guide.
 */
export function studioForRoute(route) {
  const nav = getNavItemForRoute(route);
  if (nav) return nav;
  const page = String(route || '').replace(/^#?\/?/, '').split('?')[0];
  const first = page.split('/')[0];
  const id = GUIDE_ALIASES[first] || first.replace(/-page$/, '');
  return Object.prototype.hasOwnProperty.call(STUDIO_ACADEMY, id) ? id : null;
}

const GENERIC = ['Walk me through making a video', 'What can I do in SmartVideo?', 'How do I add my API keys?'];

/** Guided walkthroughs for the panel's "Make a video" group: [{ id, title, prompt }]. */
export const journeyPrompts = () => JOURNEYS.map((j) => ({ id: j.id, title: j.title, prompt: `Walk me through: ${j.title}` }));

/** Three starter questions for the studio the user is in ("how do I X / what inputs / which lessons"). */
export function starterPrompts(studioId) {
  if (!studioId || studioId === 'apps') return GENERIC;
  if (studioId === 'academy') return ['How do the Academy tracks work?', 'Which Academy track should I start with?', 'How do I save my progress in a lesson?'];
  const label = getStudioLabel(studioId);
  if (label === studioId) return GENERIC;
  const out = [`How do I use ${label} step by step?`, `What inputs does ${label} need?`];
  out.push(STUDIO_ACADEMY[studioId]?.lessons?.length ? `Which Academy lessons cover ${label}?` : `What should I do if ${label} fails?`);
  return out;
}

/** Chip label + link for a source: "Open <Studio>", Academy lesson/course, models, app help. */
export function chipFor(s) {
  if (String(s.url).startsWith('#/academy')) return { label: 'Academy: ' + String(s.title).split(' — ')[0], url: s.url };
  if (s.kind === 'model') return { label: 'Models', url: s.url };
  if (s.kind === 'studio' && s.studioId) return { label: `Open ${getStudioLabel(s.studioId)}`, url: s.url };
  return { label: String(s.title).split(' — ')[0], url: s.url };
}

/** Which source chips to show: cited sources first, else the top 3 as "related". Adds an Academy-lessons chip for studio sources. */
export function pickChips(answer, sources) {
  const cited = new Set([...String(answer).matchAll(/\[S(\d+)\]/g)].map((m) => Number(m[1]) - 1));
  const picked = sources.filter((_s, i) => cited.has(i));
  const list = picked.length ? picked : sources.slice(0, 3);
  const seen = new Set();
  const chips = [];
  for (const s of list) {
    if (s.kind === 'journey') {
      // A walkthrough: one chip per studio on the path (in order), then its Academy course.
      for (const id of (s.studios || []).slice(0, 5)) {
        const url = `#/${id}`;
        if (!seen.has(url)) { seen.add(url); chips.push({ label: `Open ${getStudioLabel(id)}`, url }); }
      }
      if (s.guideUrl && !seen.has(s.guideUrl)) { seen.add(s.guideUrl); chips.push({ label: 'Academy course', url: s.guideUrl, academy: true }); }
      continue;
    }
    const c = chipFor(s);
    if (!seen.has(c.url)) { seen.add(c.url); chips.push(c); }
    const g = s.studioId && STUDIO_ACADEMY[s.studioId]?.lessons?.[0];
    if (s.kind === 'studio' && g) {
      const url = '#/academy/track/' + g.track;
      if (!seen.has(url)) { seen.add(url); chips.push({ label: 'Academy: ' + (TRACK_TITLES[g.track] || 'course'), url, academy: true }); }
    }
  }
  return { cited: picked.length > 0, chips };
}
