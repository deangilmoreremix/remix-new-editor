/**
 * Smart Speech (upstream toolbar "Smart Speech"): type a line, pick a
 * voice, preview it and add it to the Voiceover track. Lines can be
 * personalized with {{tokens}}; the published player speaks them with each
 * viewer's values (watch-voice) and plays the fallback line otherwise.
 *
 * Upstream used Google Cloud TTS with 150 / 70 (personalized) character
 * limits, pitch and speed. Here: MiniMax Speech HD (MuAPI, default) or
 * OpenAI gpt-4o-mini-tts, on the user's own MuAPI / OpenAI keys (BYOK, Settings → API keys)
 * via /api/agent-audio.
 */
import { VOICES, OPENAI_VOICES, TTS_PROVIDERS } from './audioGen.js';

export const LIMIT = 150;
export const PERSONAL_LIMIT = 70;
export const SAVED_KEY = 'remix.smartSpeech.voices';

export const PROVIDER_SETTINGS = {
  minimax: { voices: VOICES, defaultVoice: 'Wise_Woman', speed: [0.5, 2], pitch: true, instructions: false },
  openai: { voices: OPENAI_VOICES, defaultVoice: 'marin', speed: [0.25, 4], pitch: false, instructions: true },
};

export const hasTokens = (text) => /\{\{[^}]+\}\}/.test(String(text || ''));

/** Problems with a draft, in display order (empty when it can be generated). */
export function validateSpeech(d) {
  const errors = [];
  const text = String(d.text || '').trim();
  const personal = hasTokens(text);
  if (!text) errors.push('Type what the voice should say.');
  if (text.length > (personal ? PERSONAL_LIMIT : LIMIT)) {
    errors.push(personal ? `Personalized lines can be up to ${PERSONAL_LIMIT} characters.` : `Lines can be up to ${LIMIT} characters.`);
  }
  if (personal) {
    const fb = String(d.fallback || '').trim();
    if (!fb) errors.push('Add a fallback line for viewers without personal details.');
    else if (hasTokens(fb)) errors.push('The fallback line can’t contain {{tokens}}.');
    else if (fb.length > LIMIT) errors.push(`The fallback line can be up to ${LIMIT} characters.`);
  }
  if (!PROVIDER_SETTINGS[d.provider]) errors.push('Pick a voice provider.');
  return errors;
}

/** Request for /api/agent-audio from a draft (the text actually spoken). */
export function speechRequest(d, spokenText) {
  const p = PROVIDER_SETTINGS[d.provider] || PROVIDER_SETTINGS.minimax;
  const [lo, hi] = p.speed;
  const req = {
    provider: d.provider,
    text: spokenText,
    voice: p.voices.some(([v]) => v === d.voice) ? d.voice : p.defaultVoice,
    speed: Math.max(lo, Math.min(hi, Number(d.speed) || 1)),
  };
  if (p.pitch) req.pitch = Math.max(-12, Math.min(12, Math.round(Number(d.pitch) || 0)));
  if (p.instructions && String(d.instructions || '').trim()) req.instructions = String(d.instructions).trim().slice(0, 500);
  return req;
}

/** What a viewer's line becomes in the editor preview (the profile's values, else the fallback). */
export function previewLine(d, resolve) {
  if (!hasTokens(d.text)) return String(d.text || '').trim();
  const resolved = resolve ? String(resolve(d.text) || '') : '';
  return resolved && !hasTokens(resolved) ? resolved.trim() : String(d.fallback || '').trim();
}

/** Clip metadata stored on the timeline (and read by watch-voice). */
export function ttsMeta(d) {
  const req = speechRequest(d, '');
  return {
    provider: req.provider,
    voice: req.voice,
    speed: req.speed,
    ...(req.pitch !== undefined ? { pitch: req.pitch } : {}),
    ...(req.instructions ? { instructions: req.instructions } : {}),
    text: String(d.text || '').trim(),
    fallback: hasTokens(d.text) ? String(d.fallback || '').trim() : '',
    personalized: hasTokens(d.text),
  };
}

export function loadSavedVoices(storage = globalThis.localStorage) {
  try {
    const list = JSON.parse(storage?.getItem(SAVED_KEY) || '[]');
    return Array.isArray(list) ? list.filter((v) => v && PROVIDER_SETTINGS[v.provider]) : [];
  } catch {
    return [];
  }
}

export function saveVoice(entry, storage = globalThis.localStorage) {
  const list = loadSavedVoices(storage).filter((v) => v.name !== entry.name);
  list.unshift(entry);
  try { storage?.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 20))); } catch { /* storage full or blocked */ }
  return list.slice(0, 20);
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Panel UI.
 * @param {HTMLElement} el
 * @param {object} services
 *   generate(request) → Promise<{ url, duration }>   (generate + store)
 *   add({ url, duration, tts, name }) → clip          (Voiceover track at the playhead)
 *   resolveTokens(text) → string                      (active personalization profile)
 *   tokens: [[key, label]]
 *   toast(message, kind)
 *   storage
 */
export function renderSmartSpeech(el, services = {}) {
  const storage = services.storage ?? globalThis.localStorage;
  const d = { provider: 'minimax', voice: PROVIDER_SETTINGS.minimax.defaultVoice, speed: 1, pitch: 0, instructions: '', text: '', fallback: '' };
  let last = null; // { key, url, duration }
  let busy = false;

  const draw = () => {
    const p = PROVIDER_SETTINGS[d.provider];
    const personal = hasTokens(d.text);
    const limit = personal ? PERSONAL_LIMIT : LIMIT;
    const saved = loadSavedVoices(storage);
    el.innerHTML = `
      <div class="speech">
        ${saved.length ? `<label class="speech__row"><span>My voices</span>
          <select data-k="saved"><option value="">Choose a saved voice…</option>${saved.map((v, i) => `<option value="${i}">${esc(v.name)}</option>`).join('')}</select></label>` : ''}
        <label class="speech__row"><span>Provider</span>
          <select data-k="provider">${TTS_PROVIDERS.map(([v, l]) => `<option value="${v}"${v === d.provider ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="speech__row"><span>Voice</span>
          <select data-k="voice">${p.voices.map(([v, l]) => `<option value="${v}"${v === d.voice ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="speech__row"><span>Speed <output>${Number(d.speed).toFixed(2)}×</output></span>
          <input type="range" data-k="speed" min="${p.speed[0]}" max="${p.speed[1]}" step="0.05" value="${d.speed}"/></label>
        ${p.pitch ? `<label class="speech__row"><span>Pitch <output>${d.pitch > 0 ? '+' : ''}${d.pitch}</output></span>
          <input type="range" data-k="pitch" min="-12" max="12" step="1" value="${d.pitch}"/></label>` : ''}
        ${p.instructions ? `<label class="speech__row"><span>Delivery</span>
          <input type="text" data-k="instructions" maxlength="500" placeholder="e.g. warm and upbeat, like a friendly host" value="${esc(d.instructions)}"/></label>` : ''}
        <label class="speech__row speech__row--text"><span>Text <output class="${d.text.length > limit ? 'is-over' : ''}">${d.text.length}/${limit}</output></span>
          <textarea data-k="text" rows="3" placeholder="Hi {{firstname}}, thanks for watching!">${esc(d.text)}</textarea></label>
        ${services.tokens?.length ? `<select class="speech__tokens" data-insert-token aria-label="Insert personalization token"><option value="">+ Insert token</option>${services.tokens.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('')}</select>` : ''}
        ${personal ? `<label class="speech__row speech__row--text"><span>Fallback (no personal details) <output>${d.fallback.length}/${LIMIT}</output></span>
          <textarea data-k="fallback" rows="2" placeholder="Hi there, thanks for watching!">${esc(d.fallback)}</textarea></label>
          <p class="speech__note">In the editor you hear the line for the selected contact. On a shared link, viewers hear the fallback line.</p>` : ''}
        <ul class="speech__errors" role="alert"></ul>
        <div class="speech__actions">
          <button type="button" class="speech__btn" data-act="preview"${busy ? ' disabled' : ''}>▶ Preview</button>
          <button type="button" class="speech__btn speech__btn--primary" data-act="add"${busy ? ' disabled' : ''}>＋ Add to timeline</button>
        </div>
        <audio class="speech__audio" controls hidden></audio>
        <button type="button" class="speech__save" data-act="save">☆ Save this voice</button>
        <p class="speech__disclosure">Uses your own ${d.provider === 'openai' ? 'OpenAI' : 'MuAPI'} key from Settings → API keys. Voices are AI-generated; the shared video tells viewers so.</p>
      </div>`;
  };

  const showErrors = (list) => {
    const ul = el.querySelector('.speech__errors');
    if (ul) ul.innerHTML = list.map((e) => `<li>${esc(e)}</li>`).join('');
  };

  async function ensureAudio(forTimeline = false) {
    const errors = validateSpeech(d);
    if (errors.length) { showErrors(errors); return null; }
    // The timeline keeps the fallback line for personalized speech (what
    // viewers without details hear); the preview uses the active profile.
    const spoken = forTimeline && hasTokens(d.text) ? String(d.fallback).trim() : previewLine(d, services.resolveTokens);
    const req = speechRequest(d, spoken);
    const key = JSON.stringify(req);
    if (last?.key === key) return last;
    busy = true;
    el.querySelectorAll('[data-act="preview"], [data-act="add"]').forEach((b) => { b.disabled = true; });
    const status = el.querySelector('.speech__errors');
    if (status) status.innerHTML = '<li class="speech__busy">Generating voice…</li>';
    try {
      const out = await services.generate(req);
      last = { key, ...out };
      showErrors([]);
      return last;
    } catch (err) {
      showErrors([err?.message || 'Voice generation failed']);
      return null;
    } finally {
      busy = false;
      el.querySelectorAll('[data-act="preview"], [data-act="add"]').forEach((b) => { b.disabled = false; });
    }
  }

  el.addEventListener('input', (e) => {
    const k = e.target.dataset?.k;
    if (!k || k === 'saved' || k === 'provider' || k === 'voice') return;
    d[k] = ['speed', 'pitch'].includes(k) ? Number(e.target.value) : e.target.value;
    const out = e.target.closest('label')?.querySelector('output');
    if (out && k === 'speed') out.textContent = `${Number(d.speed).toFixed(2)}×`;
    if (out && k === 'pitch') out.textContent = `${d.pitch > 0 ? '+' : ''}${d.pitch}`;
    if (k === 'text' || k === 'fallback') {
      const wasPersonal = !!el.querySelector('[data-k="fallback"]');
      if (k === 'text' && wasPersonal !== hasTokens(d.text)) {
        const pos = e.target.selectionStart;
        draw();
        const ta = el.querySelector('[data-k="text"]');
        ta.focus();
        ta.setSelectionRange(pos, pos);
        return;
      }
      const limit = k === 'fallback' ? LIMIT : hasTokens(d.text) ? PERSONAL_LIMIT : LIMIT;
      if (out) { out.textContent = `${d[k].length}/${limit}`; out.classList.toggle('is-over', d[k].length > limit); }
    }
  });

  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset?.k === 'provider') {
      d.provider = t.value;
      d.voice = PROVIDER_SETTINGS[d.provider].defaultVoice;
      const [lo, hi] = PROVIDER_SETTINGS[d.provider].speed;
      d.speed = Math.max(lo, Math.min(hi, d.speed));
      draw();
    } else if (t.dataset?.k === 'voice') {
      d.voice = t.value;
    } else if (t.dataset?.k === 'saved' && t.value !== '') {
      const v = loadSavedVoices(storage)[Number(t.value)];
      if (v) Object.assign(d, { provider: v.provider, voice: v.voice, speed: v.speed ?? 1, pitch: v.pitch ?? 0, instructions: v.instructions || '' });
      draw();
    } else if (t.matches?.('[data-insert-token]') && t.value) {
      const ta = el.querySelector('[data-k="text"]');
      const pos = ta?.selectionStart ?? d.text.length;
      d.text = `${d.text.slice(0, pos)}{{${t.value}}}${d.text.slice(pos)}`;
      draw();
    }
  });

  el.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'save') {
      const name = (globalThis.prompt?.('Name this voice', `${d.voice} ${Number(d.speed).toFixed(2)}×`) || '').trim().slice(0, 40);
      if (!name) return;
      saveVoice({ name, provider: d.provider, voice: d.voice, speed: d.speed, pitch: d.pitch, instructions: d.instructions }, storage);
      draw();
      services.toast?.(`Saved voice "${name}"`, 'success');
      return;
    }
    const audio = await ensureAudio(act === 'add');
    if (!audio) return;
    if (act === 'preview') {
      const player = el.querySelector('.speech__audio');
      if (player) {
        player.hidden = false;
        player.src = audio.url;
        player.play?.().catch(() => {});
      }
    } else if (act === 'add') {
      const tts = ttsMeta(d);
      const label = tts.personalized ? tts.fallback : tts.text;
      services.add?.({ url: audio.url, duration: audio.duration, tts, name: `Speech: ${label.slice(0, 40)}${label.length > 40 ? '…' : ''}` });
    }
  });

  draw();
  return { draft: d, redraw: draw };
}
