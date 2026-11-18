/**
 * OpenAI Images (Images 2.6) for the Timeline Editor, on the user's own
 * OpenAI key — no MuAPI. Talks to /api/timeline-image-generate, which calls
 * the OpenAI Images API (generations, or edits with reference images).
 *
 * Models: gpt-image-2.6-flare (fast drafts, default) and
 * gpt-image-2.6-sunburst (detail, precise edits). If the user's key cannot
 * use 2.6 yet, the request is retried once on gpt-image-2.
 */
import { openaiKeyHeader } from '../../openaiKeyHeader.js';

export const IMAGE_ENDPOINT = '/api/timeline-image-generate';

export const OPENAI_IMAGE_MODELS = [
  ['gpt-image-2.6-flare', 'Images 2.6 Flare (fast)'],
  ['gpt-image-2.6-sunburst', 'Images 2.6 Sunburst (detail)'],
  ['gpt-image-2', 'GPT Image 2'],
];
export const DEFAULT_IMAGE_MODEL = 'gpt-image-2.6-flare';
export const DETAIL_IMAGE_MODEL = 'gpt-image-2.6-sunburst';
const FALLBACK_MODEL = 'gpt-image-2';

const needKey = () => new Error('Images use your own OpenAI key. Add it in Settings → API keys (OpenAI API Key).');

/** Whether an error says the model itself isn't available (so a fallback can help). */
export const isModelUnavailable = (status, message) => [400, 403, 404].includes(status)
  && /model|not (?:found|available|supported)|does not exist|access/i.test(String(message || ''));

async function post(body, { fetchImpl = fetch, signal, headers = openaiKeyHeader() } = {}) {
  if (!headers['X-OpenAI-Key']) throw needKey();
  const res = await fetchImpl(IMAGE_ENDPOINT, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw Object.assign(new Error(data?.error || `Image generation failed (HTTP ${res.status})`), { status: res.status });
  }
  return data;
}

// [remix] References can be hosted https URLs, or data:/blob: images (a previous panel's result comes back as a data: URL, and an
// upload kept in the project without cloud storage is a data: URL). Those are shrunk and sent inline so the consistency chain
// (panel 1 -> every later panel) and uploaded references work without any storage service.
const MAX_REFS = 8;
const MAX_INLINE_CHARS = 4_000_000; // Netlify functions accept ~6 MB per request
const REF_MAX_SIDE = 1024;

/** data:/blob: image -> compact JPEG data URL (falls back to the original when it is already small or no canvas exists). */
export async function toCompactDataUrl(src) {
  try {
    const noCanvas = typeof Image === 'undefined' || typeof document === 'undefined' || (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || ''));
    if (noCanvas) return /^data:image\//i.test(src) && src.length <= 1_200_000 ? src : null;
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      const t = setTimeout(() => reject(new Error('image load timed out')), 8000); // a broken image must not hang the generation
      i.onload = () => { clearTimeout(t); resolve(i); };
      i.onerror = (e) => { clearTimeout(t); reject(e); };
      i.src = src;
    });
    const k = Math.min(1, REF_MAX_SIDE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((img.naturalWidth || 1) * k));
    c.height = Math.max(1, Math.round((img.naturalHeight || 1) * k));
    const ctx = c.getContext('2d');
    if (!ctx) return /^data:image\//i.test(src) && src.length <= 1_200_000 ? src : null;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  } catch {
    return /^data:image\//i.test(src) && src.length <= 1_200_000 ? src : null;
  }
}

/** Reference list for the server: https URLs first, then compact inline images, within the request-size budget. */
export async function prepareReferences(refs = [], { toInline = toCompactDataUrl } = {}) {
  const out = [];
  let budget = MAX_INLINE_CHARS;
  const seen = new Set();
  const https = [];
  const inline = [];
  for (const u of refs) {
    if (typeof u !== 'string' || seen.has(u)) continue;
    seen.add(u);
    if (/^https:\/\//i.test(u)) https.push(u);
    else if (/^(data:image\/|blob:)/i.test(u)) inline.push(u);
  }
  out.push(...https);
  for (const u of inline) {
    if (out.length >= MAX_REFS) break;
    const d = await toInline(u);
    if (d && d.length <= budget) { out.push(d); budget -= d.length; }
  }
  return out.slice(0, MAX_REFS);
}

/**
 * Generate (or, with refs, edit) images.
 * @param {string} prompt
 * @param {object} opts { aspectRatio '16:9'|'9:16'|'1:1', quality, model, refs: https URLs, n, signal, fetchImpl, headers }
 * @returns {Promise<{ assets: Array<{ url: string, model: string, revisedPrompt?: string }>, model: string }>}
 */
export async function generateImages(prompt, { aspectRatio = '16:9', quality = 'auto', model = DEFAULT_IMAGE_MODEL, refs = [], n = 1, ...net } = {}) {
  const text = String(prompt || '').trim();
  if (!text) throw new Error('Describe the image first');
  const refList = refs.length ? await prepareReferences(refs) : [];
  const body = {
    prompt: text.slice(0, 4000),
    aspectRatio,
    quality,
    n: Math.max(1, Math.min(4, n)),
    model,
    ...(refList.length ? { referenceImageUrls: refList } : {}),
  };
  try {
    const data = await post(body, net);
    return { assets: data.assets || [], model };
  } catch (err) {
    if (model !== FALLBACK_MODEL && isModelUnavailable(err.status, err.message)) {
      const data = await post({ ...body, model: FALLBACK_MODEL }, net);
      return { assets: data.assets || [], model: FALLBACK_MODEL, fellBack: true };
    }
    throw err;
  }
}

/** data: URL → Blob */
export function dataUrlToBlob(url) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url || '');
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  const bytes = m[2] ? Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]));
  return new Blob([bytes], { type: mime });
}

/**
 * Turn generated assets into stored URLs the timeline (and MuAPI) can use.
 * data: images are stored via editor.storeBlob (Supabase Storage); https URLs
 * from OpenAI are short-lived, so they are fetched and stored too.
 */
export async function storeAssets(editor, assets, name = 'ai-image', { requireRemote = false } = {}) {
  const out = [];
  for (const [i, a] of (assets || []).entries()) {
    let blob = dataUrlToBlob(a.url);
    if (!blob && /^https?:\/\//.test(a.url)) blob = await fetch(a.url).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
    if (!blob) continue;
    out.push(await editor.storeBlob(blob, `${name}-${i + 1}.png`, { requireRemote }));
  }
  return out;
}

/** One stored image URL for a prompt (+ optional references). */
export async function makeImage(editor, prompt, opts = {}) {
  const { assets, model, fellBack } = await generateImages(prompt, opts);
  if (!assets.length) throw new Error('OpenAI returned no image');
  const [url] = await storeAssets(editor, assets.slice(0, 1), opts.name || 'ai-image', { requireRemote: !!opts.requireRemote });
  if (!url) throw new Error("Couldn't save the generated image");
  return { url, model, fellBack: !!fellBack, revisedPrompt: assets[0].revisedPrompt || null };
}
