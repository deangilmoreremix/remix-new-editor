// Ask SmartVideo — pure helpers for the panel (no DOM, unit-testable).
import { getStudio } from './studioRegistry.js';

export const ENDPOINT = '/api/ask-smartvideo';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Page id a source link points at ('#/edit' → 'edit'). */
export const pageOf = (url) => String(url || '').replace(/^#\/?/, '').split('?')[0] || 'apps';

/**
 * Safe mini-Markdown → HTML. Everything is HTML-escaped first, then only a
 * fixed set of constructs is re-introduced (bold, inline code, lists,
 * paragraphs, [S#] citations). Model output can never inject markup or links.
 */
export function renderAnswer(text, sources = []) {
  const cite = (s) => s.replace(/\[S(\d+)\]/g, (m, n) => {
    const src = sources[Number(n) - 1];
    return src ? `<a href="${esc(src.url)}" data-ask-page="${esc(pageOf(src.url))}" class="ask-cite">${n}</a>` : '';
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

const GENERIC = ['What can SmartVideo do?', 'Which studio should I use to make a video from a photo?', 'Where do I add my API keys?'];

/** Three starter questions for the studio the user is in. */
export function starterPrompts(studioId) {
  const s = studioId && getStudio(studioId);
  if (!s) return GENERIC;
  const out = [`What can I do in ${s.label}?`];
  if (s.steps?.length) out.push(`How do I use ${s.label} step by step?`);
  else out.push(`When should I use ${s.label}?`);
  out.push(s.tips?.length ? `Any tips for better results in ${s.label}?` : 'Which other studio works well with this one?');
  return out;
}

/** Which source chips to show: cited sources first, else the top 3 as "related". */
export function pickChips(answer, sources) {
  const cited = new Set([...String(answer).matchAll(/\[S(\d+)\]/g)].map((m) => Number(m[1]) - 1));
  const picked = sources.filter((_s, i) => cited.has(i));
  const list = picked.length ? picked : sources.slice(0, 3);
  const seen = new Set();
  return { cited: picked.length > 0, chips: list.filter((s) => (seen.has(s.url) ? false : seen.add(s.url))) };
}
