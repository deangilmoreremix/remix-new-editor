/**
 * Text AI for the Timeline Editor: /api/timeline-llm (OpenAI Responses API on
 * the user's own key, strict JSON output). Also builds the project context the
 * chat sees and turns a "Cut" answer into timeline clips.
 */
import { openaiKeyHeader } from '../../openaiKeyHeader.js';

export const LLM_ENDPOINT = '/api/timeline-llm';
export const CHAT_MODES = [
  ['ask', 'Ask', 'Questions about the project'],
  ['search', 'Search', 'Find quotes and moments'],
  ['cut', 'Cut', 'Rough cut / selects → new tab'],
  ['timeline', 'Timeline', 'Pacing and edit suggestions'],
];

async function authHeader() {
  try {
    const token = await globalThis.window?.Clerk?.session?.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * @returns {Promise<{ data: object, usage: object|null, model: string }>}
 */
export async function runLlm(task, input, { fetchImpl = fetch, signal, headers } = {}) {
  const keyHeaders = headers || openaiKeyHeader();
  if (!keyHeaders['X-OpenAI-Key']) throw new Error('This uses your own OpenAI key. Add it in Settings → API keys (OpenAI API Key).');
  const res = await fetchImpl(LLM_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...keyHeaders },
    body: JSON.stringify({ task, input }),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401 && data?.error?.code !== 'bad_key' && data?.error?.code !== 'need_key') throw new Error('Sign in to use the AI assistant.');
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message || `The AI assistant is unavailable (HTTP ${res.status}).`);
  return { data: data.data, usage: data.usage || null, model: data.model };
}

const fmt = (n) => Math.round(Number(n) * 100) / 100;
const one = (s, n = 120) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * Plain-text project context for the chat: every clip with id, kind, track,
 * timeline times, source in-point and speed, plus free-AI tags/descriptions
 * and caption text with timeline times. Kept under `max` characters.
 * @param {object} editor  localAIEditor()-style contract
 */
export function buildProjectContext(editor, { max = 50_000, selectedId = null, markers = [] } = {}) {
  const lines = [`Timeline length: ${fmt(editor.timelineSeconds())}s. Playhead: ${fmt(editor.playheadSec())}s.`];
  if (markers.length) lines.push(`Markers: ${markers.map((m) => `${fmt(m.t)}s${m.label ? ` "${one(m.label, 40)}"` : ''}`).join(', ')}`);
  const clips = editor.allClips();
  const byId = new Map(clips.map((c) => [String(c.id), c]));
  lines.push('CLIPS (id | type | track | timeline start–end | source in | speed | name | tags/description):');
  clips.forEach((c) => {
    const track = editor.trackOf(c);
    const s = editor.clipStart(c);
    const d = editor.clipDuration(c);
    const meta = c.metadata || {};
    const info = [meta.tags?.length ? `tags: ${meta.tags.slice(0, 8).join(', ')}` : '', meta.description ? `shows: ${one(meta.description, 160)}` : '']
      .filter(Boolean).join('; ');
    lines.push(`${c.id} | ${c.type} | ${one(track?.name, 30)} | ${fmt(s)}–${fmt(s + d)}s | in ${fmt(c.trimIn ?? 0)}s | ${fmt(c.playbackRate ?? c.speed ?? 1)}x | ${one(c.name || c.text, 60)}${info ? ` | ${info}` : ''}${String(c.id) === String(selectedId) ? ' | SELECTED' : ''}`);
  });
  const caps = clips.filter((c) => c.type === 'captions' && c.captions?.length);
  if (caps.length) {
    lines.push('TRANSCRIPTS (timeline seconds; source clip id in brackets):');
    caps.forEach((c) => {
      const s = editor.clipStart(c);
      const src = c.sourceClipId && byId.get(String(c.sourceClipId));
      let line = '';
      let lineStart = null;
      const flush = () => { if (line.trim()) lines.push(`[${fmt(lineStart)}s${src ? ` · ${src.id}` : ''}${c.lang ? ` · ${c.lang}` : ''}] ${line.trim()}`); line = ''; lineStart = null; };
      c.captions.forEach((w) => {
        if (lineStart == null) {
          lineStart = s + w.startMs / 1000;
          if (w.speaker) line = `Speaker ${w.speaker}: `;
        }
        line += w.text;
        if (/[.!?]$/.test(String(w.text).trim()) || line.length > 160) flush();
      });
      flush();
    });
  }
  let text = lines.join('\n');
  if (text.length > max) text = `${text.slice(0, max)}\n…(truncated)`;
  return text;
}

/** @Name mentions in a message (clip names, tab names, elements). */
export function parseMentions(text) {
  return [...String(text || '').matchAll(/@([\w-]{1,40})/g)].map((m) => m[1]);
}

/** Timestamps like 1:23, 01:02:03 or 12.5s in an answer → seconds. */
export function findTimestamps(text) {
  const out = [];
  const re = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.(\d+))?\b|\b(\d+(?:\.\d+)?)s\b/g;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const sec = m[5] != null ? Number(m[5]) : (Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + (m[4] ? Number(`0.${m[4]}`) : 0));
    if (Number.isFinite(sec)) out.push({ label: m[0], time: sec });
  }
  return out;
}

/**
 * Turn a cut list into clips laid end to end (copies of the source clips
 * with new in-points). Unknown clip ids and empty ranges are skipped.
 * @returns {{ clip: object, start: number, end: number, type: string }[]}  times in timeline seconds
 */
export function buildCutClips(cuts, getClip) {
  const out = [];
  let t = 0;
  (cuts || []).forEach((cut, i) => {
    const src = getClip(String(cut.clip_id));
    if (!src || !['video', 'audio', 'image'].includes(src.type)) return;
    const a = Math.max(0, Number(cut.in) || 0);
    const b = Number(cut.out);
    if (!(b > a)) return;
    const rate = Number(src.playbackRate ?? src.speed ?? 1) || 1;
    const len = (b - a) / rate;
    const copy = JSON.parse(JSON.stringify(src));
    delete copy.keyframes;
    delete copy.left;
    delete copy.width;
    copy.id = `cut-${i}-${Date.now().toString(36)}`;
    copy.trimIn = a;
    copy.name = `${src.name || src.type} · ${cut.note ? String(cut.note).slice(0, 40) : `select ${i + 1}`}`;
    out.push({ clip: copy, start: t, end: t + len, type: src.type });
    t += len;
  });
  return out;
}
