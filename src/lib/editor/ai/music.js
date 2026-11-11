/**
 * Music for the Timeline Editor (CineGen "Music" + "Composition Plan").
 *
 *   presets   genre / mood / style / tempo / instrumental / duration → one prompt
 *   generate  MuAPI Suno through /api/timeline-ai (user's own key), placed on the Music track
 *   plan      OpenAI Responses API → multi-section composition (name, style tags, duration, lyrics)
 *   compose   each section generated in order, laid end to end, fades + ducking under voiceovers
 */
import { runLlm } from './timelineLlm.js';
import { runTimelineMuapi } from './timelineMuapi.js';
import { duckingKeyframes } from '../agent/audioGen.js';

export const GENRES = ['cinematic', 'electronic', 'ambient', 'upbeat pop', 'corporate', 'lo-fi', 'orchestral', 'acoustic', 'hip hop', 'rock', 'jazz', 'folk'];
export const MOODS = ['happy', 'sad', 'tense', 'calm', 'epic', 'mysterious', 'romantic', 'playful', 'dark', 'inspiring'];
export const STYLES = ['', 'minimal', 'lush', 'driving', 'dreamy', 'gritty', 'warm', 'bright'];
export const MIN_SECONDS = 10;
export const MAX_SECONDS = 180;

/** Snap a duration to a whole number of seconds inside the model's range. */
export const snapDuration = (sec, lo = MIN_SECONDS, hi = MAX_SECONDS) => Math.max(lo, Math.min(hi, Math.round(Number(sec) || lo)));

/** Style tags string for a preset selection. */
export function styleTags({ genre, mood, style, tempo } = {}) {
  return [genre, mood, style, tempo ? `${Math.round(Number(tempo))} bpm` : ''].filter(Boolean).join(', ');
}

/**
 * @returns {{ prompt: string, style: string, duration: number, instrumental: boolean }} MuAPI music request
 */
export function buildMusicRequest({ prompt = '', genre, mood, style, tempo, duration = 30, instrumental = true } = {}) {
  const tags = styleTags({ genre, mood, style, tempo });
  const text = String(prompt || '').trim() || (tags ? `${tags} instrumental background music` : '');
  if (!text) throw new Error('Describe the music, or pick a genre and mood');
  return { prompt: text, style: tags || 'cinematic', duration: snapDuration(duration), instrumental: instrumental !== false };
}

const voiceRanges = (editor) => editor.allClips()
  .filter((c) => c.role === 'voiceover')
  .map((c) => [editor.clipStart(c), editor.clipStart(c) + editor.clipDuration(c)]);

/** Download generated audio into storage so the link doesn't expire; fall back to the remote URL. */
async function keep(editor, url, name) {
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    return await editor.storeBlob(await res.blob(), name);
  } catch {
    return url;
  }
}

/** Put one audio clip on the Music track and set its fades and ducking. */
export function placeMusic(editor, { url, name, start, seconds, volume = 0.25 }) {
  editor.growTimeline(start + seconds);
  editor.ensureTrack('Music', 'audio');
  const clip = editor.insertClip({
    id: `music-${Date.now().toString(36)}-${Math.round(start * 10)}`,
    type: 'audio', role: 'music', duck: true, name, src: url, volume, start, end: start + seconds,
  }, 'Music');
  const s = editor.clipStart(clip);
  clip.keyframes = { ...(clip.keyframes || {}), volume: duckingKeyframes(s, s + editor.clipDuration(clip), voiceRanges(editor)) };
  return clip;
}

/** Generate one track from the presets and place it at `start` (default: the playhead). */
export async function generateMusic(editor, params, { start, run = runTimelineMuapi, signal, onProgress } = {}) {
  const req = buildMusicRequest(params);
  const { url } = await run('music', { ...req, title: String(params.title || '').slice(0, 60) || undefined }, { signal, onProgress, timeoutMs: 5 * 60_000 });
  const stored = await keep(editor, url, 'music.mp3');
  editor.snapshot();
  const clip = placeMusic(editor, { url: stored, name: `Music: ${req.prompt.slice(0, 40)}`, start: Math.max(0, Number(start ?? editor.playheadSec()) || 0), seconds: req.duration });
  editor.commit();
  editor.toast('Music added to the Music track', 'success');
  return clip;
}

// ---------------------------------------------------------------- Composition Plan

/** Clean a plan from the model (or the user's edits) into sections we can generate. */
export function normalizePlan(plan) {
  const sections = (Array.isArray(plan?.sections) ? plan.sections : []).slice(0, 8).map((s, i) => ({
    name: String(s.name || `Section ${i + 1}`).slice(0, 60),
    style_tags: String(s.style_tags || '').slice(0, 200),
    description: String(s.description || '').slice(0, 300),
    duration: snapDuration(s.duration, MIN_SECONDS, 60),
    lyrics: String(s.lyrics || '').slice(0, 1500),
  }));
  return { title: String(plan?.title || 'Composition').slice(0, 80), global_style: String(plan?.global_style || '').slice(0, 200), sections };
}

/** Ask the model for a score plan. `context` describes the video (e.g. from the chat's project context). */
export async function planComposition(context, { seconds = 60, llm = runLlm, signal } = {}) {
  const text = `Target length: about ${Math.round(seconds)} seconds.\n\n${String(context || '').slice(0, 20_000) || 'A short video.'}`;
  const { data } = await llm('composition', { text }, { signal });
  const plan = normalizePlan(data);
  if (!plan.sections.length) throw new Error('The AI returned no sections — add more detail about the video');
  return plan;
}

/** MuAPI request for one section (the global style is shared by every section). */
export function sectionRequest(plan, section) {
  return {
    style: [plan.global_style, section.style_tags].filter(Boolean).join(', ') || 'cinematic',
    prompt: section.description || section.name,
    lyrics: section.lyrics,
    title: `${plan.title} — ${section.name}`,
    duration: section.duration,
    instrumental: !section.lyrics.trim(),
  };
}

/**
 * Generate every section in order and lay them end to end on the Music track.
 * Stops at the first failure but keeps what was already placed.
 * @returns {{ placed: object[], failed: string|null }}
 */
export async function composeFromPlan(editor, plan, { start, run = runTimelineMuapi, signal, onSection } = {}) {
  const placed = [];
  let t = Math.max(0, Number(start ?? editor.playheadSec()) || 0);
  for (const [i, section] of plan.sections.entries()) {
    if (signal?.aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
    onSection?.(i, section, 'generating');
    try {
      const { url } = await run('music', sectionRequest(plan, section), { signal, timeoutMs: 5 * 60_000 });
      const stored = await keep(editor, url, `music-${i + 1}.mp3`);
      editor.snapshot();
      placed.push(placeMusic(editor, { url: stored, name: `${plan.title} · ${section.name}`, start: t, seconds: section.duration }));
      editor.commit();
      t += section.duration;
      onSection?.(i, section, 'done');
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      onSection?.(i, section, 'failed');
      return { placed, failed: `${section.name}: ${err.message}` };
    }
  }
  return { placed, failed: null };
}
