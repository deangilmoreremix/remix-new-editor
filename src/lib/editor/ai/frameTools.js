/**
 * Frame tools (CineGen Quick Edit and Frame Chat) for the clip at the playhead.
 *
 *   quickEdit   instruction → Images 2.6 edit of the current frame (OpenAI, user's key),
 *               added as an image clip at the playhead
 *   askFrame    a question about the current frame (Responses API with the frame as image input)
 */
import { frameAtPlayhead } from '../ml/aiActions.js';
import { canvasToBlob } from '../ml/frameGrab.js';
import { makeImage, DETAIL_IMAGE_MODEL } from './openaiImages.js';
import { runLlm } from './timelineLlm.js';
import { listElements, resolveMentions } from './elementsStore.js';

/** The current frame as a stored https URL (so OpenAI can read it for an edit). */
export async function frameToUrl(editor, clip, { signal } = {}) {
  const canvas = await frameAtPlayhead(editor, clip, { maxSize: 1536, signal });
  return editor.storeBlob(await canvasToBlob(canvas, 'image/png'), 'quick-edit-source.png', { requireRemote: true });
}

/**
 * Edit the frame with a plain-language instruction and put the result at the playhead.
 * @returns {Promise<object>} the new image clip
 */
export async function quickEdit(editor, clip, instruction, { aspect = '16:9', seconds = 3, make = makeImage, signal } = {}) {
  const text = String(instruction || '').trim();
  if (!text) throw new Error('Say what to change, e.g. "make it night" or "remove the car"');
  const source = await frameToUrl(editor, clip, { signal });
  const { text: expanded, refs } = resolveMentions(text, await listElements());
  const { url } = await make(editor, `Edit this image: ${expanded}. Keep everything else exactly the same — composition, people, lighting and framing.`, {
    model: DETAIL_IMAGE_MODEL, aspectRatio: aspect, refs: [source, ...refs].slice(0, 8), name: 'quick-edit', signal,
  });
  const t = editor.playheadSec();
  editor.snapshot();
  const added = editor.insertClip({ id: `qe-${Date.now().toString(36)}`, type: 'image', name: `Quick edit: ${text.slice(0, 40)}`, src: url, fit: 'cover', start: t, end: t + seconds, metadata: { quickEdit: text } }, 'video');
  editor.commit();
  editor.toast('Edited frame added at the playhead', 'success');
  return added;
}

/** A JPEG data URL of the current frame, small enough to send inline. */
export async function frameToDataUrl(editor, clip, { signal, maxSize = 768 } = {}) {
  const canvas = await frameAtPlayhead(editor, clip, { maxSize, signal });
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.82);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Couldn't read the frame"));
    r.readAsDataURL(blob);
  });
}

/** Ask about the current frame. */
export async function askFrame(editor, clip, question, { llm = runLlm, signal } = {}) {
  const text = String(question || '').trim();
  if (!text) throw new Error('Ask something about the frame');
  const image = await frameToDataUrl(editor, clip, { signal });
  const { data } = await llm('frame', { text, image }, { signal });
  return String(data?.answer || '').trim();
}
