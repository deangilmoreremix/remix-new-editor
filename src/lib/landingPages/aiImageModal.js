// src/lib/landingPages/aiImageModal.js
//
// "Create with AI" for any picture field in the page editor. Opens a small dark modal that makes pictures with
// OpenAI Images 2.6 on the user's own key (src/lib/editor/aiImageService.js generateImage: Flare for fast drafts,
// Sunburst for detail, an automatic fallback to GPT Image 2 for accounts without 2.6 yet), then saves the one
// you pick to storage so the page gets a permanent https link (pages only accept https pictures).
import { generateImage } from '../editor/aiImageService.js';
import { DEFAULT_IMAGE_MODEL, DETAIL_IMAGE_MODEL } from '../editor/ai/openaiImages.js';

/** The two Images 2.6 engines, labelled like the personalization image editor. */
export const ENGINES = Object.freeze({
  draft: { model: DEFAULT_IMAGE_MODEL, label: 'Fast draft (2.6 Flare)' },
  detail: { model: DETAIL_IMAGE_MODEL, label: 'Detailed render (2.6 Sunburst)' },
});
export const SHAPES = Object.freeze([['16:9', 'Wide'], ['1:1', 'Square'], ['9:16', 'Tall']]);

/** The shape a picture field usually wants: faces and logos are square, the rest wide. */
export function shapeForLabel(label = '') {
  const l = String(label);
  if (/avatar|face|portrait|logo|icon|mark|person|headshot/i.test(l)) return '1:1';
  if (/tall|story|phone|vertical/i.test(l)) return '9:16';
  return '16:9';
}

/** A starting prompt from the field's name, the page title and the remembered business line. The user edits it. */
export function promptForField({ label = '', pageTitle = '', brief = '' } = {}) {
  const l = String(label);
  const about = [pageTitle, brief].map((v) => String(v || '').trim()).filter(Boolean).join(' — ');
  let base;
  if (/avatar|face|portrait|headshot|testimonial/i.test(l)) base = 'Friendly, natural portrait photo of a smiling customer, soft daylight';
  else if (/logo|mark|icon/i.test(l)) base = 'Simple, clean logo mark on a plain background';
  else if (/poster|placeholder|video|viewer/i.test(l)) base = 'Cinematic still frame that makes people want to press play';
  else if (/background|banner|photo/i.test(l)) base = 'Wide, uncluttered photo with room for text on one side';
  else base = 'Professional, high-quality image';
  return `${base}${about ? ` for: ${about}` : ''}. No text, letters or watermarks in the image.`;
}

/** Binary file from a data URL (what the generator returns). Null when it is not one. */
export function dataUrlToFile(dataUrl, name = 'ai-image') {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl || ''));
  if (!m) return null;
  const bin = atob(m[2].replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  const ext = (m[1].split('/')[1] || 'png').replace('jpeg', 'jpg');
  return new File([bytes], `${name}.${ext}`, { type: m[1] });
}

/** A generated picture as a permanent https link: hosted ones are used as they are, data URLs are uploaded. */
export async function persistImage(asset, { upload, save } = {}) {
  const url = String(asset?.url || '');
  let finalUrl = '';
  if (/^https:\/\//i.test(url)) finalUrl = url;
  else {
    const file = dataUrlToFile(url, `ai-${Date.now().toString(36)}`);
    if (!file) throw new Error('That picture could not be read.');
    if (!upload) throw new Error('Sign in to save pictures to your account.');
    const saved = await upload(file);
    finalUrl = saved?.url || '';
    if (!/^https:\/\//i.test(finalUrl)) throw new Error('The picture could not be saved.');
  }
  try { save?.({ url: finalUrl, type: 'image', studio: 'landing', prompt: asset?.prompt || '', model: asset?.model || '' }); } catch { /* the library copy is a bonus */ }
  return finalUrl;
}

/**
 * Make pictures. Returns { assets, note }. `note` says so when the account has no 2.6 access yet and the
 * service fell back to GPT Image 2. Throws an Error with a readable message on failure.
 */
export async function makeImages({ prompt, shape = '16:9', engine = 'draft', n = 2 }, { generate = generateImage } = {}) {
  const wanted = (ENGINES[engine] || ENGINES.draft).model;
  const res = await generate({ prompt, aspectRatio: shape, n, model: wanted === DEFAULT_IMAGE_MODEL ? undefined : wanted });
  if (!res?.ok) throw new Error(res?.error || 'Image generation failed.');
  const assets = (res.assets || []).filter((a) => a?.url);
  if (!assets.length) throw new Error('No picture came back. Try again with a different description.');
  const used = String(assets[0]?.model || '');
  const note = used && !used.startsWith('gpt-image-2.6') ? 'Your OpenAI account does not have Images 2.6 yet, so this used GPT Image 2.' : '';
  return { assets, note };
}

const readable = (msg) => {
  const m = String(msg || '');
  if (/own OpenAI key/i.test(m)) return `${m}`;
  if (/moderation|safety|policy/i.test(m)) return 'OpenAI blocked that description. Try different words.';
  if (/429|credit|quota|rate/i.test(m)) return 'Your OpenAI account is rate-limited or out of credit. Check your OpenAI billing, then try again.';
  return m || 'Image generation failed.';
};

const css = {
  overlay: 'position:fixed;inset:0;z-index:20000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.78);padding:16px',
  dialog: 'width:100%;max-width:720px;max-height:92vh;overflow:auto;background:#0a0a0a;border:1px solid rgba(255,255,255,.12);border-radius:18px;color:#fff;font-family:Inter,system-ui,sans-serif;padding:18px;display:grid;gap:12px',
  input: 'width:100%;box-sizing:border-box;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:10px;padding:9px 12px;font:inherit;font-size:13px',
  btn: 'background:transparent;border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer',
  // The app never fills buttons (outlined, accent edge), so the main action is outlined in the accent colour.
  primary: 'background:transparent;border:1px solid var(--lp-accent,#d9ff00);color:var(--lp-accent,#d9ff00);border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:800;cursor:pointer',
};
const el = (tag, style, text) => { const n = document.createElement(tag); if (style) n.style.cssText = style; if (text !== undefined) n.textContent = text; return n; };

/**
 * The modal. `onUse(url, { prompt, model })` receives the permanent https link of the picture the user picked.
 * `deps` lets tests replace the network and storage.
 */
export function openAiImageModal({ label = 'Picture', pageTitle = '', brief = '', onUse, onClose, deps = {} } = {}) {
  const generate = deps.generate;
  let upload = deps.upload;
  let save = deps.save;
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const overlay = el('div', css.overlay);
  overlay.dataset.aiImageModal = '';
  const dialog = el('div', css.dialog);
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Create a picture with AI');
  overlay.appendChild(dialog);

  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    document.body.style.overflow = prevOverflow;
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

  const head = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:12px');
  head.append(el('strong', 'font-size:15px;letter-spacing:.04em;text-transform:uppercase', 'Create a picture with AI'));
  const x = el('button', css.btn, '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', close);
  head.appendChild(x);

  const field = el('p', 'margin:0;font-size:12px;color:#a1a1aa', `For: ${label}`);
  const prompt = el('textarea', css.input);
  prompt.rows = 4;
  prompt.dataset.aiPrompt = '';
  prompt.setAttribute('aria-label', 'Describe the picture');
  prompt.value = promptForField({ label, pageTitle, brief });

  const row = el('div', 'display:flex;flex-wrap:wrap;gap:10px;align-items:center');
  const engineSel = el('select', css.input + ';width:auto'); engineSel.dataset.aiEngine = ''; engineSel.setAttribute('aria-label', 'Engine');
  Object.entries(ENGINES).forEach(([k, v]) => { const o = el('option', '', v.label); o.value = k; engineSel.appendChild(o); });
  const shapeSel = el('select', css.input + ';width:auto'); shapeSel.dataset.aiShape = ''; shapeSel.setAttribute('aria-label', 'Shape');
  SHAPES.forEach(([k, v]) => { const o = el('option', '', v); o.value = k; shapeSel.appendChild(o); });
  shapeSel.value = shapeForLabel(label);
  const go = el('button', css.primary, 'Create pictures'); go.type = 'button'; go.dataset.aiGo = '';
  row.append(engineSel, shapeSel, go);

  const status = el('p', 'margin:0;font-size:12px;color:#a1a1aa;min-height:16px'); status.setAttribute('role', 'status'); status.dataset.aiStatus = '';
  const grid = el('div', 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px');
  grid.dataset.aiResults = '';

  dialog.append(head, field, prompt, row, status, grid);
  document.body.appendChild(overlay);
  prompt.focus();

  async function ensureStorage() {
    if (upload) return;
    try {
      const [{ uploadFileToSupabase }, sb, gh] = await Promise.all([import('../uploadService.js'), import('../supabase.js'), import('../generationHistory.js')]);
      upload = (file) => uploadFileToSupabase(file, { category: 'image', userId: sb.getClerkUserId?.() || undefined });
      save = save || ((e) => gh.saveGeneration(e));
    } catch { /* leave undefined: persistImage explains */ }
  }

  go.addEventListener('click', async () => {
    const text = prompt.value.trim();
    if (!text) { status.textContent = 'Describe the picture first.'; return; }
    go.disabled = true; grid.replaceChildren(); status.style.color = '#a1a1aa'; status.textContent = 'Creating… this takes a few seconds.';
    try {
      const { assets, note } = await makeImages({ prompt: text, shape: shapeSel.value, engine: engineSel.value, n: 2 }, { generate });
      status.textContent = note || 'Pick the one you like.';
      assets.forEach((a) => {
        const card = el('div', 'display:grid;gap:6px');
        const img = el('img', 'width:100%;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:#141414'); img.src = a.url; img.alt = text.slice(0, 120);
        const use = el('button', css.btn, 'Use this picture'); use.type = 'button'; use.dataset.aiUse = '';
        use.addEventListener('click', async () => {
          use.disabled = true; use.textContent = 'Saving…';
          try {
            await ensureStorage();
            const url = await persistImage({ ...a, prompt: text }, { upload, save });
            onUse?.(url, { prompt: text, model: a.model || '' });
            close();
          } catch (err) {
            use.disabled = false; use.textContent = 'Use this picture';
            status.style.color = '#f87171'; status.textContent = readable(err?.message);
          }
        });
        card.append(img, use); grid.appendChild(card);
      });
    } catch (err) {
      status.style.color = '#f87171'; status.textContent = readable(err?.message);
    }
    go.disabled = false;
  });

  return { close, el: overlay };
}
