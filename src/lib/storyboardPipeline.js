/**
 * Storyboard pipeline: script -> scenes -> shot list -> frames -> animatic -> deck.
 *
 * Pure functions only (no DOM, no network) so they are shared by the studio UI,
 * the creation apps and tests. Frames use the shape from storyboardEngine.createFrame.
 */
import { createFrame, renumberFrames, totalDuration, SHOT_TYPES } from './storyboardEngine.js';

const SCENE_RE = /^\s*((?:INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s].+|\.[A-Za-z0-9].+)$/i;

/* ───────────────────────── script parsing ───────────────────────── */

function decodeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Detect 'fdx' | 'fountain' | 'text' from content (and optional file name). */
export function detectScriptFormat(text, fileName = '') {
  if (/\.fdx$/i.test(fileName) || /<FinalDraft[\s>]/i.test(text)) return 'fdx';
  if (/\.fountain$/i.test(fileName) || /^\s*(Title|Credit|Author|Draft date):/im.test(text) || SCENE_RE.test(text.split('\n').find((l) => l.trim()) || '')) return 'fountain';
  return 'text';
}

/** Final Draft XML -> flat paragraph list [{type, text}]. */
function fdxParagraphs(xml) {
  const out = [];
  const paraRe = /<Paragraph\b[^>]*\bType="([^"]*)"[^>]*>([\s\S]*?)<\/Paragraph>/gi;
  let m;
  while ((m = paraRe.exec(xml))) {
    const text = [...m[2].matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/gi)].map((t) => decodeXml(t[1])).join('').trim();
    if (text) out.push({ type: m[1], text });
  }
  return out;
}

/** Fountain / plain-ish text -> flat paragraph list. */
function textParagraphs(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  // Skip a Fountain title page (key: value block ending at first blank line).
  let i = 0;
  if (/^[A-Za-z ]+:/.test(lines[0] || '')) {
    while (i < lines.length && lines[i].trim()) i++;
  }
  let prevBlank = true;
  for (; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t) { prevBlank = true; continue; }
    if (SCENE_RE.test(t)) out.push({ type: 'Scene Heading', text: t.replace(/^\./, '') });
    else if (/^\(.*\)$/.test(t)) out.push({ type: 'Parenthetical', text: t });
    else if (prevBlank && /^[A-Z0-9 ._'-]{2,30}(\s*\(.*\))?$/.test(t) && /[A-Z]/.test(t) && i + 1 < lines.length && lines[i + 1].trim()) {
      out.push({ type: 'Character', text: t.replace(/\s*\(.*\)$/, '') });
    } else if (out.length && /^(Character|Parenthetical|Dialogue)$/.test(out[out.length - 1].type) && !prevBlank) {
      out.push({ type: 'Dialogue', text: t });
    } else if (out.length && out[out.length - 1].type === 'Character') {
      out.push({ type: 'Dialogue', text: t });
    } else out.push({ type: 'Action', text: t });
    prevBlank = false;
  }
  return out;
}

/**
 * Parse a script into scenes: [{ number, heading, action, dialogue:[{character,line}], characters:[], location }].
 * Unstructured prose (no scene headings) becomes one scene per paragraph block.
 */
export function parseScript(text, { fileName = '', format } = {}) {
  const src = String(text || '');
  const fmt = format || detectScriptFormat(src, fileName);
  const paras = fmt === 'fdx' ? fdxParagraphs(src) : textParagraphs(src);
  const hasHeadings = paras.some((p) => p.type === 'Scene Heading');

  const scenes = [];
  let cur = null;
  let speaker = '';
  const start = (heading) => {
    cur = { number: scenes.length + 1, heading, action: [], dialogue: [], characters: [], location: heading.replace(/^(INT|EXT|EST|I\/E|INT\.?\/EXT)[.\s]+/i, '').replace(/\s+-\s+.*$/, '').trim() };
    scenes.push(cur);
  };

  for (const p of paras) {
    if (p.type === 'Scene Heading') { start(p.text.toUpperCase()); speaker = ''; continue; }
    if (!cur) start(hasHeadings ? 'UNTITLED SCENE' : 'SCENE 1');
    if (!hasHeadings && p.type === 'Action' && cur.action.length) { start(`SCENE ${scenes.length + 1}`); }
    if (p.type === 'Character') {
      speaker = p.text.toUpperCase();
      if (!cur.characters.includes(speaker)) cur.characters.push(speaker);
    } else if (p.type === 'Dialogue') {
      cur.dialogue.push({ character: speaker || 'UNKNOWN', line: p.text });
    } else if (p.type === 'Action' || p.type === 'General') {
      cur.action.push(p.text);
    }
  }
  return scenes;
}

/** Unique characters across scenes, with the scenes they appear in. */
export function extractCharacters(scenes) {
  const map = new Map();
  scenes.forEach((s) => s.characters.forEach((c) => {
    const e = map.get(c) || { name: c, scenes: [] };
    e.scenes.push(s.number);
    map.set(c, e);
  }));
  return [...map.values()];
}

/* ───────────────────────── shot list ───────────────────────── */

const ESTABLISH_RE = /\b(establish|skyline|aerial|landscape|city|street|exterior|horizon)\b/i;
const DETAIL_RE = /\b(hand|eyes?|phone|letter|key|tear|detail|object|close)\b/i;
const MOVE_RE = [
  [/\b(chase|run|runs|race|sprint|pursu)/i, 'Tracking'],
  [/\b(drive|fly|flies|soar)/i, 'Crane / Drone'],
  [/\b(approach|enter|step closer|slowly)/i, 'Dolly In'],
  [/\b(retreat|leave|walk away)/i, 'Dolly Out'],
  [/\b(look up|rises?|ascend)/i, 'Tilt Up'],
  [/\b(shaky|panic|fight)/i, 'Handheld'],
];

/** Choose a shot type and camera move for a beat of text. `index` is the beat's position in its scene. */
export function suggestCoverage(text, index = 0, isDialogue = false) {
  let shot;
  if (index === 0 && (ESTABLISH_RE.test(text) || !isDialogue)) shot = 'Wide Shot';
  else if (isDialogue) shot = index % 2 ? 'Close-Up' : 'Medium Shot';
  else if (DETAIL_RE.test(text)) shot = 'Extreme Close-Up';
  else shot = SHOT_TYPES[(index + 1) % 2 ? 1 : 0];
  const move = (MOVE_RE.find(([re]) => re.test(text)) || [null, 'Static'])[1];
  return { shot, cameraMovement: move };
}

/** ~3s base plus reading time for dialogue (about 2.5 words/second), clamped 2..12. */
export function estimateShotDuration(text, isDialogue = false) {
  const words = String(text).split(/\s+/).filter(Boolean).length;
  const secs = isDialogue ? 1.5 + words / 2.5 : 2.5 + words / 8;
  return Math.max(2, Math.min(12, Math.round(secs)));
}

/**
 * Turn scenes into an ordered shot list. Each action paragraph and each dialogue
 * exchange becomes a beat; beats are capped by `maxShotsPerScene`.
 * Returns plain shot objects (see shotsToFrames to get studio frames).
 */
export function buildShotList(scenes, { maxShotsPerScene = 6, lookSuffix = '' } = {}) {
  const shots = [];
  scenes.forEach((scene) => {
    const beats = [];
    scene.action.forEach((a) => beats.push({ text: a, dialogue: false }));
    scene.dialogue.forEach((d) => beats.push({ text: d.line, speaker: d.character, dialogue: true }));
    if (!beats.length) beats.push({ text: scene.heading, dialogue: false });

    // Order: first action establishes, then interleave remaining action and dialogue.
    const actions = beats.filter((b) => !b.dialogue);
    const talk = beats.filter((b) => b.dialogue);
    const ordered = [];
    while (actions.length || talk.length) {
      if (actions.length) ordered.push(actions.shift());
      if (talk.length) ordered.push(talk.shift());
    }
    ordered.slice(0, Math.max(1, maxShotsPerScene)).forEach((b, i) => {
      const cov = suggestCoverage(b.text, i, b.dialogue);
      const visual = b.dialogue ? `${b.speaker} speaking: "${b.text}"` : b.text;
      shots.push({
        sceneNumber: scene.number,
        shotNumber: i + 1,
        heading: scene.heading,
        location: scene.location,
        shot: cov.shot,
        cameraMovement: cov.cameraMovement,
        duration: estimateShotDuration(b.text, b.dialogue),
        prompt: `${scene.location}. ${visual}${lookSuffix}`.slice(0, 600),
        narration: b.dialogue ? b.text : '',
        notes: b.dialogue ? `Dialogue: ${b.speaker}` : '',
        characters: b.dialogue ? [b.speaker] : scene.characters,
      });
    });
  });
  return shots;
}

/** Convert shot-list entries to studio frames (renumbered). */
export function shotsToFrames(shots) {
  return renumberFrames(shots.map((s) => createFrame(s)));
}

/** Shot list as CSV (round-trips into spreadsheets, as production teams expect). */
export function shotListToCsv(frames) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Scene', 'Shot', 'Shot Type', 'Camera', 'Duration (s)', 'Description', 'Dialogue / VO', 'Notes'];
  const rows = frames.map((f) => [f.sceneNumber, f.shotNumber, f.shot, f.cameraMovement, f.duration, f.prompt, f.narration, f.notes].map(esc).join(','));
  return [head.map(esc).join(','), ...rows].join('\n');
}

/** Parse an uploaded shot-list CSV (the format above) back into frames. */
export function csvToFrames(csv) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(csv).replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!head) return [];
  const col = (re) => head.findIndex((h) => re.test(h));
  const ix = { scene: col(/scene/i), shot: col(/^shot$/i), type: col(/type/i), cam: col(/camera/i), dur: col(/dur/i), desc: col(/desc|prompt/i), vo: col(/dialog|vo|narr/i), notes: col(/note/i) };
  const get = (r, i) => (i >= 0 ? r[i] || '' : '');
  return renumberFrames(body.map((r) => createFrame({
    sceneNumber: Number(get(r, ix.scene)) || 1,
    shot: SHOT_TYPES.includes(get(r, ix.type)) ? get(r, ix.type) : 'Wide Shot',
    cameraMovement: get(r, ix.cam) || 'Static',
    duration: Number(get(r, ix.dur)) || 3,
    prompt: get(r, ix.desc),
    narration: get(r, ix.vo),
    notes: get(r, ix.notes),
  })));
}

/* ───────────────────────── animatic ───────────────────────── */

/**
 * Timeline for an animatic: [{ index, id, start, end, duration, imageUrl, caption, move }].
 * Playback code walks this; `at(t)` finds the active entry.
 */
export function buildAnimaticTimeline(frames) {
  let t = 0;
  const entries = frames.map((f, index) => {
    const duration = Math.max(1, Number(f.duration) || 3);
    const e = { index, id: f.id, start: t, end: t + duration, duration, imageUrl: f.imageUrl || null, caption: f.narration || '', move: f.cameraMovement || 'Static', label: `${f.sceneNumber}.${f.shotNumber}` };
    t += duration;
    return e;
  });
  return {
    entries,
    total: t,
    at(time) {
      if (!entries.length) return null;
      const clamped = Math.max(0, Math.min(time, t - 1e-6));
      return entries.find((e) => clamped >= e.start && clamped < e.end) || entries[entries.length - 1];
    },
  };
}

/** Ken-Burns style CSS transform for a camera move at progress p (0..1). */
export function cameraMoveTransform(move, p) {
  const e = Math.max(0, Math.min(1, p));
  switch (move) {
    case 'Dolly In': case 'Zoom In': return `scale(${(1 + 0.15 * e).toFixed(4)})`;
    case 'Dolly Out': return `scale(${(1.15 - 0.15 * e).toFixed(4)})`;
    case 'Pan Left': return `scale(1.1) translateX(${(3 - 6 * e).toFixed(3)}%)`;
    case 'Pan Right': case 'Tracking': return `scale(1.1) translateX(${(-3 + 6 * e).toFixed(3)}%)`;
    case 'Tilt Up': return `scale(1.1) translateY(${(3 - 6 * e).toFixed(3)}%)`;
    case 'Tilt Down': return `scale(1.1) translateY(${(-3 + 6 * e).toFixed(3)}%)`;
    default: return 'scale(1)';
  }
}

/** WebVTT captions for the animatic (dialogue / VO lines). */
export function animaticToVtt(frames) {
  const fmt = (s) => {
    const ms = Math.round(s * 1000);
    const p = (n, w = 2) => String(n).padStart(w, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
  };
  const { entries } = buildAnimaticTimeline(frames);
  const cues = entries.filter((e) => e.caption).map((e, i) => `${i + 1}\n${fmt(e.start)} --> ${fmt(e.end)}\n${e.caption}`);
  return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}

/* ───────────────────────── pitch deck ───────────────────────── */

const THEMES = {
  noir: { bg: '#0b0b0f', fg: '#f4f4f5', accent: '#f5c451', card: '#16161d' },
  paper: { bg: '#faf8f3', fg: '#1c1c1c', accent: '#b4281f', card: '#ffffff' },
  studio: { bg: '#0f172a', fg: '#e2e8f0', accent: '#38bdf8', card: '#1e293b' },
};
export const DECK_THEMES = Object.keys(THEMES);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^(https?:|data:image\/|blob:)/i.test(u || '') ? u : '');

/**
 * Standalone, print-ready HTML pitch deck (one slide per scene group, 16:9 pages;
 * "Print / Save as PDF" in a browser produces the PDF). All user text is escaped.
 */
export function buildPitchDeckHtml({ title = 'Untitled', logline = '', frames = [], characters = [], theme = 'noir' } = {}) {
  const th = THEMES[theme] || THEMES.noir;
  const scenes = new Map();
  frames.forEach((f) => { (scenes.get(f.sceneNumber) || scenes.set(f.sceneNumber, []).get(f.sceneNumber)).push(f); });
  const dur = totalDuration(frames);

  const shotCard = (f) => `<figure><div class="img">${safeUrl(f.imageUrl) ? `<img src="${esc(safeUrl(f.imageUrl))}" alt="Shot ${f.sceneNumber}.${f.shotNumber}">` : '<span>No image</span>'}</div><figcaption><b>${f.sceneNumber}.${f.shotNumber} · ${esc(f.shot)} · ${esc(f.cameraMovement)} · ${f.duration}s</b><br>${esc(f.prompt)}</figcaption></figure>`;

  const slides = [
    `<section class="title"><h1>${esc(title)}</h1><p>${esc(logline)}</p><small>${scenes.size} scenes · ${frames.length} shots · ${Math.floor(dur / 60)}m ${dur % 60}s</small></section>`,
    characters.length ? `<section><h2>Characters</h2><ul class="chars">${characters.map((c) => `<li><b>${esc(c.name)}</b><br>${esc(c.description || '')}</li>`).join('')}</ul></section>` : '',
    ...[...scenes.entries()].flatMap(([n, fs]) => {
      const pages = [];
      for (let i = 0; i < fs.length; i += 4) pages.push(fs.slice(i, i + 4));
      return pages.map((pg, i) => `<section><h2>Scene ${n}${i ? ' (cont.)' : ''}</h2><div class="grid">${pg.map(shotCard).join('')}</div></section>`);
    }),
  ].filter(Boolean).join('\n');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)} – Pitch Deck</title>
<style>
@page{size:1280px 720px;margin:0}
*{box-sizing:border-box}body{margin:0;background:${th.bg};color:${th.fg};font-family:system-ui,sans-serif}
section{width:1280px;height:720px;padding:48px 64px;page-break-after:always;overflow:hidden;position:relative}
h1{font-size:64px;margin:200px 0 16px;color:${th.accent}}h2{font-size:32px;margin:0 0 24px;color:${th.accent}}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
figure{margin:0;background:${th.card};border-radius:10px;padding:10px;font-size:13px}
.img{aspect-ratio:16/7;background:#0003;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:6px}.img img{width:100%;height:100%;object-fit:cover}
.chars{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;list-style:none;padding:0}.chars li{background:${th.card};padding:16px;border-radius:10px}
</style></head><body>
${slides}
</body></html>`;
}
