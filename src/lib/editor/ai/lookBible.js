/**
 * Look Bible (CineGen Director): genre, film references, mood-board stills and
 * notes that set the visual style for every storyboard frame, plus "rewrite a
 * shot from a director's note" (keep / discard). Text on the OpenAI Responses
 * API and stills on Images 2.6, both with the user's own OpenAI key.
 */
import { runLlm } from './timelineLlm.js';
import { makeImage, DETAIL_IMAGE_MODEL } from './openaiImages.js';

export const LOOK_GENRES = ['', 'drama', 'thriller', 'sci-fi', 'comedy', 'documentary', 'horror', 'romance', 'action', 'fantasy', 'commercial', 'music video'];
const STORE = 'timeline-look-bible-v1';

export const emptyLook = () => ({ genre: '', references: [], notes: '', palette: [], lens: '', moodboard: [] });

/** Film-reference chips from a comma/line separated string. */
export const parseReferences = (text) => [...new Set(String(text || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean))].slice(0, 8);

/** The style line added to every frame prompt. */
export function lookStyle(look) {
  if (!look) return '';
  return [
    look.genre && `${look.genre} genre`,
    look.references?.length && `in the visual style of ${look.references.join(', ')}`,
    look.palette?.length && `palette: ${look.palette.join(', ')}`,
    look.lens,
    look.notes,
  ].filter(Boolean).join('. ').slice(0, 600);
}

export function loadLook() {
  try { return { ...emptyLook(), ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { return emptyLook(); }
}
export function saveLook(look) {
  try { localStorage.setItem(STORE, JSON.stringify(look)); } catch { /* storage unavailable: keep in memory */ }
}

/** Expand the genre, references and notes into a fuller look bible (AI). */
export async function expandLook(look, { llm = runLlm, signal } = {}) {
  const text = `Genre: ${look.genre || 'unspecified'}\nFilm references: ${look.references.join(', ') || 'none'}\nNotes: ${look.notes || 'none'}`;
  const { data } = await llm('lookbible', { text }, { signal });
  return { ...look, notes: data.notes || look.notes, palette: data.palette || [], lens: data.lens_and_light || '', references: look.references.length ? look.references : (data.references || []).map((r) => String(r).split(/[:—-]/)[0].trim()).filter(Boolean).slice(0, 8) };
}

/** Mood-board stills (Images 2.6) from the look bible. */
export async function makeMoodboard(editor, look, { count = 3, make = makeImage, signal } = {}) {
  const base = lookStyle(look) || 'cinematic film still';
  const scenes = ['an establishing wide shot', 'an intimate close-up portrait', 'a detail of an important object'].slice(0, count);
  const urls = [];
  for (const scene of scenes) {
    if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    const { url } = await make(editor, `Mood board still: ${scene}. ${base}. Cinematic film still, no text.`, { model: DETAIL_IMAGE_MODEL, aspectRatio: '16:9', name: 'moodboard', signal });
    urls.push(url);
  }
  return urls;
}

/** Rewrite a shot from a director's note. Returns the proposal; the caller keeps or discards it. */
export async function rewriteShot(shot, note, { look, llm = runLlm, signal } = {}) {
  const n = String(note || '').trim();
  if (!n) throw new Error('Type a director note first');
  const text = `SHOT PROMPT: ${shot.prompt}\nCAMERA: ${shot.camera}\nLOOK: ${lookStyle(look) || 'none'}\nDIRECTOR NOTE: ${n}`;
  const { data } = await llm('rewrite', { text }, { signal });
  if (!String(data?.prompt || '').trim()) throw new Error('The AI returned an empty rewrite — try again');
  return { prompt: String(data.prompt).slice(0, 2000), camera: String(data.camera || shot.camera).slice(0, 120), note: n };
}

/**
 * Compare a script breakdown with the saved Elements.
 * @param {{scenes: {characters: string[], locations: string[], props: string[]}[]}} breakdown
 * @param {{handle: string}[]} elements
 * @returns {{ name: string, category: 'character'|'location'|'prop', existing: object|null }[]}
 */
export function matchBreakdown(breakdown, elements, slug) {
  const seen = new Map();
  (breakdown?.scenes || []).forEach((sc) => {
    [['character', sc.characters], ['location', sc.locations], ['prop', sc.props]].forEach(([category, names]) => {
      (names || []).forEach((raw) => {
        const name = String(raw || '').trim();
        if (!name) return;
        const key = `${category}:${slug(name).toLowerCase()}`;
        if (!seen.has(key)) seen.set(key, { name, category, existing: (elements || []).find((e) => e.handle.toLowerCase() === slug(name).toLowerCase()) || null });
      });
    });
  });
  return [...seen.values()];
}
