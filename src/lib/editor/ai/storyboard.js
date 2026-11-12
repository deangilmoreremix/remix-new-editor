/**
 * Storyboarder and Shot Board (CineGen) for the Timeline Editor.
 *
 *   plan   idea/script → shots           OpenAI Responses API (user's key)
 *   frame  shot → still image            OpenAI Images 2.6 (user's key), @Elements as references
 *   animate frame → clip (optional)      MuAPI image-to-video (user's key)
 *   place  shots → timeline              video track + captions for dialogue
 *
 * Shot Board: 9 camera angles of one frame with Images 2.6 edits.
 */
import { runLlm } from './timelineLlm.js';
import { makeImage, DEFAULT_IMAGE_MODEL, DETAIL_IMAGE_MODEL } from './openaiImages.js';
import { resolveMentions, elementsBrief } from './elementsStore.js';
import { runTimelineMuapi } from './timelineMuapi.js';

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
let seq = 0;

/** Clean up shots from the model (or the user) into editable cards. */
export function normalizeShots(shots) {
  return (Array.isArray(shots) ? shots : []).slice(0, 12).map((s, i) => ({
    id: s.id || `shot-${Date.now().toString(36)}-${(seq += 1)}`,
    title: String(s.title || `Shot ${i + 1}`).slice(0, 80),
    camera: String(s.camera || '').slice(0, 120),
    prompt: String(s.prompt || '').slice(0, 2000),
    duration: Math.max(1, Math.min(15, Math.round(num(s.duration, 4) * 2) / 2)),
    dialogue: String(s.dialogue || '').slice(0, 500),
    frameUrl: s.frameUrl || null,
    clipUrl: s.clipUrl || null,
  }));
}

export async function planShots(text, { shots = 6, style = '', elements = [], llm = runLlm, signal } = {}) {
  if (!String(text || '').trim()) throw new Error('Type an idea or paste a script first');
  const { data } = await llm('storyboard', { text, shots, style, elements: elementsBrief(elements) }, { signal });
  const out = normalizeShots(data?.shots);
  if (!out.length) throw new Error('The AI returned no shots — try a longer idea');
  return { title: data?.title || 'Storyboard', shots: out };
}

const ASPECTS = { '16:9': '16:9', '9:16': '9:16', '1:1': '1:1' };

/** Full image prompt for a shot (camera + prompt, with @Elements expanded). */
export function shotPrompt(shot, elements = [], style = '') {
  const { text, refs } = resolveMentions(`${shot.prompt}${shot.camera ? `. Camera: ${shot.camera}` : ''}${style ? `. Style: ${style}` : ''}`, elements);
  return { prompt: `${text}. Cinematic film still, no text or captions.`, refs };
}

export async function frameForShot(editor, shot, { elements = [], style = '', model = DEFAULT_IMAGE_MODEL, aspect = '16:9', make = makeImage, signal } = {}) {
  const { prompt, refs } = shotPrompt(shot, elements, style);
  const { url, model: used } = await make(editor, prompt, { model, aspectRatio: ASPECTS[aspect] || '16:9', refs, name: `shot-${shot.id}`, requireRemote: false, signal });
  return { url, model: used };
}

export async function animateShot(shot, { model, run = runTimelineMuapi, signal, onProgress } = {}) {
  if (!/^https:\/\//.test(String(shot.frameUrl || ''))) throw new Error('Make the frame first (sign in so it is saved online)');
  const { url } = await run('shot_video', { model, imageUrl: shot.frameUrl, prompt: `${shot.prompt}${shot.camera ? `. Camera: ${shot.camera}` : ''}`, duration: shot.duration }, { signal, onProgress });
  return url;
}

/**
 * Put the shots on the timeline after the last clip of the main video track
 * (or at 0), with one captions clip carrying the dialogue.
 * @returns {{ start: number, end: number, clips: object[] }}
 */
export function placeShots(editor, shots, { captionStyle } = {}) {
  const ready = shots.filter((s) => s.clipUrl || s.frameUrl);
  if (!ready.length) throw new Error('Make at least one frame first');
  const videoClips = editor.allClips().filter((c) => c.type === 'video' || c.type === 'image');
  let t = videoClips.reduce((m, c) => Math.max(m, editor.clipStart(c) + editor.clipDuration(c)), 0);
  const start = t;
  const total = ready.reduce((a, s) => a + s.duration, 0);
  editor.snapshot();
  editor.growTimeline(start + total);
  const placed = [];
  const captions = [];
  ready.forEach((s) => {
    const clip = editor.insertClip({
      id: `sb-${s.id}`,
      type: s.clipUrl ? 'video' : 'image',
      name: s.title,
      src: s.clipUrl || s.frameUrl,
      volume: s.clipUrl ? 1 : undefined,
      trimIn: 0,
      fit: 'cover',
      start: t,
      end: t + s.duration,
      metadata: { storyboard: true, prompt: s.prompt, camera: s.camera },
    }, 'video');
    placed.push(clip);
    if (s.dialogue.trim()) captions.push({ text: s.dialogue.trim(), startMs: Math.round((t - start) * 1000), endMs: Math.round((t - start + s.duration) * 1000) });
    t += s.duration;
  });
  if (captions.length) {
    placed.push(editor.insertClip({
      id: `sb-captions-${Date.now().toString(36)}`, type: 'captions', name: 'Storyboard dialogue', captions, captionStyle, start, end: t,
    }, 'text'));
  }
  editor.commit();
  return { start, end: t, clips: placed };
}

// ---------------------------------------------------------------- Shot Board

export const SHOT_BOARD_ANGLES = [
  ['Wide', 'wide establishing shot of the same scene'],
  ['Medium', 'medium shot, waist up'],
  ['Close-up', 'close-up on the face / main subject'],
  ['Extreme close-up', 'extreme close-up on a telling detail'],
  ['Over the shoulder', 'over-the-shoulder shot'],
  ['Low angle', 'low angle looking up'],
  ['High angle', 'high angle looking down'],
  ['Profile', 'side profile shot'],
  ['POV', 'point-of-view shot from the subject'],
];

/**
 * Nine camera angles of one reference frame (Images 2.6 edits, Sunburst for
 * detail). Calls onShot(index, url | Error) as each finishes.
 */
export async function shotBoard(editor, refUrl, { note = '', model = DETAIL_IMAGE_MODEL, aspect = '16:9', concurrency = 2, make = makeImage, onShot, signal } = {}) {
  if (!/^https:\/\//.test(String(refUrl || ''))) throw new Error('The reference frame must be saved online first (sign in)');
  const results = new Array(SHOT_BOARD_ANGLES.length).fill(null);
  let next = 0;
  const worker = async () => {
    while (next < SHOT_BOARD_ANGLES.length) {
      const i = next;
      next += 1;
      if (signal?.aborted) return;
      const [label, angle] = SHOT_BOARD_ANGLES[i];
      try {
        const { url } = await make(editor, `Same characters, wardrobe, location and lighting as the reference image. New camera angle: ${angle}.${note ? ` ${note}` : ''} Cinematic film still, no text.`, {
          model, aspectRatio: aspect, refs: [refUrl], name: `shotboard-${label.toLowerCase().replace(/\W+/g, '-')}`, signal,
        });
        results[i] = url;
        onShot?.(i, url);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        results[i] = err;
        onShot?.(i, err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(4, concurrency)) }, worker));
  return results;
}
