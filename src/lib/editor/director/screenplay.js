/**
 * Screenplay import for the Timeline Editor's Director tools.
 *
 * Ported from CineGen (MIT) src/lib/director/{screenplay,fdx-parser,
 * scene-split}.ts, plus Fountain markup CineGen's plain-text parser does not
 * cover (title page, notes, boneyard, forced elements).
 *
 * Element types: scene | action | character | parenthetical | dialogue | transition
 */

let seq = 0;
const id = () => `el-${Date.now().toString(36)}-${(seq += 1)}`;

const SCENE_HEADING = /^\s*(INT|EXT|EST|INT\.?\/EXT|I\.?\/E)[\s.]/i;
const TRANSITION = /(TO:|^FADE (IN|OUT)|^DISSOLVE|^SMASH CUT|^MATCH CUT)/;
const FDX_CHROME = /<(ElementSettings|FontSpec|ParagraphSpec|Behavior|Outline|WindowState|SmartType|HeaderAndFooter|MoresAndContinueds)\b/i;

export function isFdxChromeLine(text) {
  return FDX_CHROME.test(text)
    || /\bAdornmentStyle\s*=/.test(text)
    || /\bPaginateAs\s*=/.test(text)
    || /\bFont\s*=\s*"Courier Final Draft"/i.test(text);
}

export function trimFdxTrailer(text) {
  const tagIdx = text.search(FDX_CHROME);
  const lines = text.split('\n');
  const lineIdx = lines.findIndex((line) => isFdxChromeLine(line));
  const lineCut = lineIdx === -1 ? -1 : lines.slice(0, lineIdx).join('\n').length;
  const cuts = [tagIdx, lineCut].filter((n) => n >= 0);
  if (!cuts.length) return text;
  return text.slice(0, Math.min(...cuts)).replace(/\s+$/, '');
}

export function scrubFdxChrome(elements) {
  const out = [];
  for (const el of elements) {
    if (isFdxChromeLine(el.text)) break;
    const text = trimFdxTrailer(el.text);
    if (!text) break;
    out.push(text === el.text ? el : { ...el, text });
  }
  return out;
}

const isAllCaps = (line) => {
  const letters = line.replace(/[^A-Za-z]/g, '');
  return letters.length > 0 && letters === letters.toUpperCase();
};
const isCharacterCue = (t) => t.length > 0 && t.length <= 30 && !SCENE_HEADING.test(t) && isAllCaps(t) && !t.endsWith(':');

/** Remove Fountain title page, [[notes]] and /* boneyard *\/ blocks. */
export function stripFountainExtras(source) {
  let s = String(source || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\[\[[\s\S]*?\]\]/g, '');
  // Title page: leading "Key: value" lines up to the first blank line.
  const lines = s.split('\n');
  if (/^(title|credit|author|authors|source|draft date|date|contact|copyright|notes)\s*:/i.test(lines[0] || '')) {
    const end = lines.findIndex((l) => l.trim() === '');
    s = end === -1 ? '' : lines.slice(end + 1).join('\n');
  }
  return s;
}

/** Plain text / Fountain → screenplay elements. */
export function parseToScreenplay(source) {
  const elements = [];
  let inDialogue = false;
  for (const raw of trimFdxTrailer(stripFountainExtras(source)).split('\n')) {
    const t = raw.trim();
    if (t === '') { inDialogue = false; continue; }
    let type;
    let text = t;
    if (/^\.[^.]/.test(t)) { type = 'scene'; text = t.slice(1).trim(); inDialogue = false; } // Fountain forced heading
    else if (/^!/.test(t)) { type = 'action'; text = t.slice(1).trim(); inDialogue = false; } // forced action
    else if (/^@/.test(t)) { type = 'character'; text = t.slice(1).trim(); inDialogue = true; } // forced character
    else if (/^>/.test(t) && !/<$/.test(t)) { type = 'transition'; text = t.slice(1).trim(); inDialogue = false; } // forced transition
    else if (SCENE_HEADING.test(t)) { type = 'scene'; inDialogue = false; }
    else if (isAllCaps(t) && TRANSITION.test(t)) { type = 'transition'; inDialogue = false; }
    else if (isCharacterCue(t)) { type = 'character'; inDialogue = true; }
    else if (inDialogue && /^\(.*\)$/.test(t)) type = 'parenthetical';
    else if (inDialogue) type = 'dialogue';
    else { type = 'action'; text = t.replace(/^>\s*|\s*<$/g, ''); }
    if (text) elements.push({ id: id(), type, text });
  }
  return { elements };
}

// ---------------------------------------------------------------- Final Draft

const FDX_TYPES = {
  'scene heading': 'scene', action: 'action', general: 'action', shot: 'action',
  character: 'character', dialogue: 'dialogue', parenthetical: 'parenthetical', transition: 'transition',
};

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");

function paragraphText(inner) {
  const runs = inner.match(/<Text[^>]*>([\s\S]*?)<\/Text>/gi);
  if (!runs) return '';
  return decode(runs.map((r) => r.replace(/<Text[^>]*>/i, '').replace(/<\/Text>/i, '')).join('')).trim();
}

export const looksLikeFdx = (raw) => /<FinalDraft\b/i.test(raw) && /<Paragraph\b/i.test(raw);

function fdxScriptBody(raw) {
  const scriptOnly = raw
    .replace(/<TitlePage\b[^>]*>[\s\S]*?<\/TitlePage>/gi, '')
    .replace(/<HeaderAndFooter\b[^>]*>[\s\S]*?<\/HeaderAndFooter>/gi, '')
    .replace(/<ElementSettings\b[^>]*>[\s\S]*?<\/ElementSettings>/gi, '');
  const content = scriptOnly.match(/<Content\b[^>]*>([\s\S]*?)<\/Content>/i);
  return content ? content[1] : scriptOnly;
}

/** Final Draft .fdx (XML) → screenplay, or null if it isn't one. */
export function parseFdx(raw) {
  try {
    const unwrapped = fdxScriptBody(raw).replace(/<\/?DualDialogue\b[^>]*>/gi, '');
    const paras = unwrapped.match(/<Paragraph\b[^>]*>[\s\S]*?<\/Paragraph>/gi);
    if (!paras?.length) return null;
    const elements = [];
    for (const p of paras) {
      const rawType = (p.match(/<Paragraph\b[^>]*\bType\s*=\s*"([^"]*)"/i)?.[1] || '').trim().toLowerCase();
      const inner = p.replace(/^<Paragraph\b[^>]*>/i, '').replace(/<\/Paragraph>$/i, '');
      const text = trimFdxTrailer(paragraphText(inner));
      if (!text || isFdxChromeLine(text)) continue;
      elements.push({ id: id(), type: FDX_TYPES[rawType] || 'action', text });
    }
    const cleaned = scrubFdxChrome(elements);
    return cleaned.length ? { elements: cleaned } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- scenes

const TIME_WORDS = /\b(DAY|NIGHT|DUSK|DAWN|MORNING|AFTERNOON|EVENING|CONTINUOUS|LATER|MOMENTS LATER|SAME)\b/i;
const INT_EXT = /^\s*(INT\.?\/EXT|I\.?\/E|INT|EXT|EST)\.?\s*/i;

export function parseHeading(heading) {
  const intExtMatch = heading.match(/^\s*(INT\.?\/EXT|I\.?\/E|INT|EXT|EST)\b/i);
  const intExt = intExtMatch ? intExtMatch[1].toUpperCase().replace(/\.$/, '') : undefined;
  let timeOfDay;
  const dash = heading.split(/\s[-—–]\s/);
  if (dash.length > 1) {
    const tail = dash[dash.length - 1].trim();
    if (TIME_WORDS.test(tail)) timeOfDay = tail.toUpperCase();
  }
  if (!timeOfDay) {
    const w = heading.match(TIME_WORDS);
    if (w) timeOfDay = w[1].toUpperCase();
  }
  let place = heading.replace(INT_EXT, '');
  if (dash.length > 1 && timeOfDay) place = dash.slice(0, -1).join(' - ').replace(INT_EXT, '');
  return { intExt, timeOfDay, place: place.trim() };
}

export function splitScenes(doc) {
  const scenes = [];
  let current = null;
  for (const el of doc.elements) {
    if (el.type === 'scene') {
      const meta = parseHeading(el.text);
      current = { index: scenes.length, heading: el.text, intExt: meta.intExt, timeOfDay: meta.timeOfDay, place: meta.place, elements: [el] };
      scenes.push(current);
    } else {
      if (!current) { current = { index: 0, heading: '', elements: [] }; scenes.push(current); }
      current.elements.push(el);
    }
  }
  return scenes;
}

/** Screenplay → plain text (keeps block boundaries so it re-parses the same). */
export function serializeScreenplay(doc) {
  const out = [];
  doc.elements.forEach((el, i) => {
    const prev = doc.elements[i - 1];
    const newBlock = el.type === 'scene' || el.type === 'character' || el.type === 'transition'
      || (el.type === 'action' && prev && ['character', 'parenthetical', 'dialogue'].includes(prev.type));
    if (i > 0 && newBlock && out[out.length - 1] !== '') out.push('');
    out.push(el.text);
  });
  return out.join('\n');
}

/** Characters (cue names, without extensions like (V.O.)) appearing in a scene. */
export function sceneCharacters(scene) {
  return [...new Set(scene.elements.filter((e) => e.type === 'character').map((e) => e.text.replace(/\s*\(.*\)\s*$/, '').trim()))];
}

/** Dialogue lines in a scene: [{ character, text }]. */
export function sceneDialogue(scene) {
  const out = [];
  let who = null;
  scene.elements.forEach((e) => {
    if (e.type === 'character') who = e.text.replace(/\s*\(.*\)\s*$/, '').trim();
    else if (e.type === 'dialogue' && who) out.push({ character: who, text: e.text });
  });
  return out;
}

/** Any supported script file → { screenplay, scenes, text }. */
export function importScript(raw, fileName = '') {
  const isFdx = /\.fdx$/i.test(fileName) || looksLikeFdx(raw);
  const screenplay = (isFdx && parseFdx(raw)) || parseToScreenplay(raw);
  return { screenplay, scenes: splitScenes(screenplay), text: serializeScreenplay(screenplay) };
}
