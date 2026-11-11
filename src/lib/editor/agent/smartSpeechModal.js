/**
 * Smart Speech window (upstream "TEXT TO SPEECH", components/media/
 * GoogleTextToSpeech.jsx + textToSpeech/TextToSpeechLibrary.jsx), rebuilt:
 *
 *   Create   left: provider, voice, speed + pitch (MiniMax) or delivery
 *            (OpenAI), text with Personalize voice tokens and a 150/70
 *            counter, fallback line, Preview / Add to timeline.
 *            right: voice card carousel (◀ ▶), Save voice.
 *   Library  the project's Smart Speech lines, as "Voice" / "Personalized
 *            voice" (upstream's library tabs), with play and Use settings.
 *
 * Runs on the user's own MuAPI / OpenAI keys (BYOK); the logic lives in
 * smartSpeech.js. Styled with the timeline tokens (timeline-addons.css).
 */
import { TTS_PROVIDERS } from './audioGen.js';
import {
  LIMIT, PERSONAL_LIMIT, PROVIDER_SETTINGS, hasTokens, validateSpeech, speechRequest, previewLine, ttsMeta,
  loadSavedVoices, saveVoice,
} from './smartSpeech.js';
import { contactName, resolveLineFor, voiceForContacts } from '../personalize/perContact.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PROVIDER_LABEL = { minimax: 'MiniMax', openai: 'OpenAI' };
const KEY_NAME = { minimax: 'MuAPI', openai: 'OpenAI' };

/** Voice name + description from a [id, label] entry ("Marin — natural, warm" or "Calm female"). */
export function voiceInfo(provider, id) {
  const entry = (PROVIDER_SETTINGS[provider]?.voices || []).find(([v]) => v === id);
  const label = entry?.[1] || id;
  const [name, desc] = label.includes(' — ') ? label.split(' — ') : [String(id).replace(/_/g, ' '), label];
  return { id, name, desc };
}

const initials = (name) => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const hue = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

/**
 * @param {object} services
 *   generate(request) → Promise<{ url, duration }>
 *   add({ url, duration, tts, name })
 *   resolveTokens(text) → string
 *   tokens: [[key, label]]
 *   listClips() → [{ id, name, src, tts }]
 *   listContacts() → Personalization Studio contact profiles (per-contact voices)
 *   hasKey(provider) → boolean
 *   toast(message, kind)
 *   storage
 * @returns {{ el, close(), draft }}
 */
export function openSmartSpeechModal(services = {}, { mount = document.body } = {}) {
  const storage = services.storage ?? globalThis.localStorage;
  const d = { provider: 'minimax', voice: PROVIDER_SETTINGS.minimax.defaultVoice, speed: 1, pitch: 0, instructions: '', text: '', fallback: '' };
  const ui = { tab: 'create', libTab: 'voice', busy: false, errors: [], tokenMenu: false, caret: null,
    view: 'form', selected: null, progress: null, controller: null };
  let last = null; // { key, url, duration }
  const player = typeof Audio !== 'undefined' ? new Audio() : null;

  const backdrop = document.createElement('div');
  backdrop.className = 'speech-modal';
  mount.appendChild(backdrop);

  const voices = () => PROVIDER_SETTINGS[d.provider].voices;
  const keyMissing = () => services.hasKey && !services.hasKey(d.provider);

  function createHtml() {
    const p = PROVIDER_SETTINGS[d.provider];
    const personal = hasTokens(d.text);
    const limit = personal ? PERSONAL_LIMIT : LIMIT;
    const saved = loadSavedVoices(storage);
    const v = voiceInfo(d.provider, d.voice);
    const idx = voices().findIndex(([id]) => id === d.voice);
    return `
      <div class="speech-modal__create">
        <div class="speech-modal__form">
          ${saved.length ? `<div class="speech-modal__saved" aria-label="My voices">${saved.map((s, i) => `<button type="button" class="speech-modal__chip" data-saved="${i}" title="${esc(`${PROVIDER_LABEL[s.provider]} · ${s.voice}`)}">${esc(s.name)}</button>`).join('')}</div>` : ''}
          <div class="speech-modal__seg" role="radiogroup" aria-label="Voice provider">
            ${TTS_PROVIDERS.map(([id, label]) => `<button type="button" role="radio" aria-checked="${id === d.provider}" class="speech-modal__seg-btn${id === d.provider ? ' is-on' : ''}" data-provider="${id}" title="${esc(label)}">${esc(PROVIDER_LABEL[id])}</button>`).join('')}
          </div>
          <label class="speech-modal__field"><span>Voice</span>
            <select data-k="voice">${p.voices.map(([id, label]) => `<option value="${esc(id)}"${id === d.voice ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
          <div class="speech-modal__sliders">
            <label class="speech-modal__field"><span>Speed <output data-out="speed">${Number(d.speed).toFixed(2)}×</output></span>
              <input type="range" data-k="speed" min="${p.speed[0]}" max="${p.speed[1]}" step="0.05" value="${d.speed}"/></label>
            ${p.pitch ? `<label class="speech-modal__field"><span>Pitch <output data-out="pitch">${d.pitch > 0 ? '+' : ''}${d.pitch}</output></span>
              <input type="range" data-k="pitch" min="-12" max="12" step="1" value="${d.pitch}"/></label>` : ''}
          </div>
          ${p.instructions ? `<label class="speech-modal__field"><span>Delivery</span>
            <input type="text" data-k="instructions" maxlength="500" placeholder="e.g. warm and upbeat, like a friendly host" value="${esc(d.instructions)}"/></label>` : ''}
          <label class="speech-modal__field speech-modal__field--text"><span>Text <output data-out="text" class="${d.text.length > limit ? 'is-over' : ''}">${d.text.length}/${limit}</output></span>
            <textarea data-k="text" rows="3" placeholder="Hi {{firstname}}, thanks for watching!">${esc(d.text)}</textarea></label>
          <div class="speech-modal__tokenbar">
            <button type="button" class="speech-modal__ghost" data-act="tokens" aria-expanded="${ui.tokenMenu}">✦ Personalize voice</button>
            <span class="speech-modal__hint">Up to ${PERSONAL_LIMIT} characters with personalization, ${LIMIT} without.</span>
            ${ui.tokenMenu && services.tokens?.length ? `<div class="speech-modal__tokens" role="menu">${services.tokens.map(([k, l]) => `<button type="button" role="menuitem" data-token="${esc(k)}">${esc(l)} <code>{{${esc(k)}}}</code></button>`).join('')}</div>` : ''}
          </div>
          ${personal ? `<label class="speech-modal__field speech-modal__field--text"><span>Fallback text <output data-out="fallback">${d.fallback.length}/${LIMIT}</output></span>
            <textarea data-k="fallback" rows="2" placeholder="Hi there, thanks for watching!">${esc(d.fallback)}</textarea></label>
            <p class="speech-modal__note">Used when a viewer’s details aren’t known. In the editor you hear the line for the selected contact; on a shared link viewers hear this fallback.</p>` : ''}
          <ul class="speech-modal__errors" role="alert">${ui.busy ? '<li class="is-busy">Generating voice…</li>' : ui.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
          ${keyMissing() ? `<p class="speech-modal__key">Add your ${KEY_NAME[d.provider]} key in <strong>Settings → API keys</strong> to use ${PROVIDER_LABEL[d.provider]} voices.</p>` : ''}
          <audio class="speech-modal__audio" controls hidden></audio>
        </div>
        <aside class="speech-modal__voice" aria-label="Voice">
          <div class="speech-modal__carousel">
            <button type="button" class="speech-modal__arrow" data-step="-1" aria-label="Previous voice">◀</button>
            <div class="speech-modal__card">
              <span class="speech-modal__avatar" style="--h:${hue(v.id)}">${esc(initials(v.name))}</span>
              <strong class="speech-modal__voice-name">${esc(v.name)}</strong>
              <span class="speech-modal__voice-desc">${esc(v.desc)}</span>
              <span class="speech-modal__voice-meta">${esc(PROVIDER_LABEL[d.provider])} · ${idx + 1} of ${voices().length}</span>
            </div>
            <button type="button" class="speech-modal__arrow" data-step="1" aria-label="Next voice">▶</button>
          </div>
          <button type="button" class="speech-modal__ghost" data-act="save">☆ Save voice</button>
          <p class="speech-modal__byok">Uses your own ${KEY_NAME[d.provider]} key from Settings → API keys. Voices are AI-generated; shared videos tell viewers so.</p>
        </aside>
      </div>
      <footer class="speech-modal__foot">
        <button type="button" class="speech-modal__btn" data-act="preview"${ui.busy ? ' disabled' : ''}>▶ Preview</button>
        <button type="button" class="speech-modal__btn speech-modal__btn--primary" data-act="add"${ui.busy ? ' disabled' : ''}>＋ Add to timeline</button>
      </footer>`;
  }

  // Personalized line → one voice per Personalization Studio contact.
  function contactsHtml() {
    const contacts = services.listContacts?.() || [];
    if (!ui.selected) ui.selected = new Set(contacts.filter((c) => resolveLineFor(d.text, c)).map((c) => String(c.id)));
    const chosen = contacts.filter((c) => ui.selected.has(String(c.id)));
    const lines = new Set(chosen.map((c) => resolveLineFor(d.text, c)).filter(Boolean));
    const p = ui.progress;
    return `
      <div class="speech-modal__contacts">
        <p class="speech-modal__lead">Each contact gets this line with their own details, voiced by <strong>${esc(voiceInfo(d.provider, d.voice).name)}</strong>. Everyone else hears the fallback: “${esc(d.fallback)}”.</p>
        ${contacts.length ? `
          <div class="speech-modal__contacts-bar">
            <label><input type="checkbox" data-all ${chosen.length && chosen.length === contacts.filter((c) => resolveLineFor(d.text, c)).length ? 'checked' : ''}/> All contacts</label>
            <span>${chosen.length} selected · ${lines.size} different line${lines.size === 1 ? '' : 's'} to voice (plus the fallback)</span>
          </div>
          <ul class="speech-modal__contact-list">${contacts.map((c) => {
            const line = resolveLineFor(d.text, c);
            const id = String(c.id);
            return `<li class="speech-modal__contact${line ? '' : ' is-missing'}">
              <input type="checkbox" data-contact="${esc(id)}" ${ui.selected.has(id) ? 'checked' : ''} ${line && !p ? '' : 'disabled'} aria-label="${esc(contactName(c))}"/>
              <div><strong>${esc(contactName(c))}${c.source === 'lead-finder' ? ' <em class="speech-modal__lead-chip">Lead</em>' : ''}</strong><span>${line ? `“${esc(line)}”` : 'Missing a detail this line uses: hears the fallback'}</span></div>
            </li>`;
          }).join('')}</ul>` : `
          <p class="speech-modal__empty">No contacts yet. Add them in the <strong>Personalize</strong> window (Personalization Studio); business details saved from its <strong>Find a Business</strong> search fill business tokens like {{businessName}}. You can still add this line now: everyone hears the fallback.</p>`}
        <ul class="speech-modal__errors" role="alert">${p ? `<li class="is-busy">Voicing ${p.done} of ${p.total}${p.name ? ` · ${esc(p.name)}` : ''}…</li>` : ui.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
      </div>
      <footer class="speech-modal__foot">
        <button type="button" class="speech-modal__btn" data-act="${p ? 'stop' : 'back'}">${p ? 'Stop' : '← Back'}</button>
        <button type="button" class="speech-modal__btn speech-modal__btn--primary" data-act="voice-all"${p ? ' disabled' : ''}>${chosen.length ? `Voice ${chosen.length} contact${chosen.length === 1 ? '' : 's'} &amp; add to timeline` : 'Add with fallback only'}</button>
      </footer>`;
  }

  async function voiceAllAndAdd() {
    const contacts = (services.listContacts?.() || []).filter((c) => ui.selected?.has(String(c.id)));
    const errors = validateSpeech(d);
    if (errors.length) { ui.errors = errors; draw(); return; }
    ui.controller = new AbortController();
    ui.errors = [];
    ui.progress = { done: 0, total: contacts.length + 1, name: 'fallback' };
    draw();
    try {
      const fallback = await services.generate(speechRequest(d, String(d.fallback).trim()));
      ui.progress = { done: 1, total: contacts.length + 1 };
      draw();
      const { variants } = await voiceForContacts({
        text: d.text,
        contacts,
        signal: ui.controller.signal,
        generate: (line) => services.generate(speechRequest(d, line)),
        onProgress: ({ done, name }) => { ui.progress = { done: done + 1, total: contacts.length + 1, name }; draw(); },
      });
      const tts = { ...ttsMeta(d), variants };
      const longest = Math.max(Number(fallback.duration) || 0, ...Object.values(variants).map((v) => Number(v.duration) || 0));
      const n = Object.keys(variants).length;
      services.add?.({ url: fallback.url, duration: longest || fallback.duration, tts, name: `Speech: ${String(d.fallback).slice(0, 30)}${n ? ` · ${n} personalized` : ''}` });
      close();
    } catch (err) {
      ui.progress = null;
      ui.errors = [err?.name === 'AbortError' ? 'Stopped. Nothing was added.' : (err?.message || 'Voice generation failed')];
      draw();
    }
  }

  function libraryHtml() {
    const clips = (services.listClips?.() || []).filter((c) => c?.tts);
    const shown = clips.filter((c) => !!c.tts.personalized === (ui.libTab === 'personalized'));
    return `
      <div class="speech-modal__lib">
        <div class="speech-modal__seg" role="tablist" aria-label="Library">
          <button type="button" role="tab" aria-selected="${ui.libTab === 'voice'}" class="speech-modal__seg-btn${ui.libTab === 'voice' ? ' is-on' : ''}" data-lib="voice">Voice</button>
          <button type="button" role="tab" aria-selected="${ui.libTab === 'personalized'}" class="speech-modal__seg-btn${ui.libTab === 'personalized' ? ' is-on' : ''}" data-lib="personalized">Personalized voice</button>
        </div>
        ${shown.length ? `<ul class="speech-modal__list">${shown.map((c) => {
          const v = voiceInfo(c.tts.provider, c.tts.voice);
          return `<li class="speech-modal__row">
            <button type="button" class="speech-modal__play" data-play="${esc(c.src)}" aria-label="Play">▶</button>
            <div class="speech-modal__row-text"><strong>${esc(c.tts.text)}</strong>
              <span>${esc(PROVIDER_LABEL[c.tts.provider] || c.tts.provider)} · ${esc(v.name)}${c.tts.personalized ? ` · ${Object.keys(c.tts.variants || {}).length} contacts voiced · fallback: “${esc(c.tts.fallback)}”` : ''}</span></div>
            <button type="button" class="speech-modal__ghost" data-use="${esc(c.id)}">Use settings</button>
          </li>`;
        }).join('')}</ul>` : `<p class="speech-modal__empty">${ui.libTab === 'personalized' ? 'No personalized lines yet. Add a {{token}} to a line in Create.' : 'No speech lines yet. Create one and add it to the timeline.'}</p>`}
      </div>`;
  }

  function draw() {
    const focus = document.activeElement?.dataset?.k;
    const pos = document.activeElement?.selectionStart;
    backdrop.innerHTML = `
      <div class="speech-modal__dialog" role="dialog" aria-modal="true" aria-label="Smart Speech">
        <header class="speech-modal__head">
          <h3>🗣️ Smart Speech</h3>
          <div class="speech-modal__tabs" role="tablist">
            <button type="button" role="tab" aria-selected="${ui.tab === 'create'}" class="speech-modal__tab${ui.tab === 'create' ? ' is-on' : ''}" data-tab="create">Create</button>
            <button type="button" role="tab" aria-selected="${ui.tab === 'library'}" class="speech-modal__tab${ui.tab === 'library' ? ' is-on' : ''}" data-tab="library">Library</button>
          </div>
          <button type="button" class="speech-modal__close" aria-label="Close">✕</button>
        </header>
        <div class="speech-modal__body">${ui.tab === 'library' ? libraryHtml() : ui.view === 'contacts' ? contactsHtml() : createHtml()}</div>
      </div>`;
    if (focus) {
      const el = backdrop.querySelector(`[data-k="${focus}"]`);
      if (el) { el.focus(); if (pos != null && el.setSelectionRange) el.setSelectionRange(pos, pos); }
    }
  }

  const setErrors = (list) => { ui.errors = list; const ul = backdrop.querySelector('.speech-modal__errors'); if (ul) ul.innerHTML = list.map((e) => `<li>${esc(e)}</li>`).join(''); };

  async function ensureAudio(forTimeline) {
    const errors = validateSpeech(d);
    if (errors.length) { setErrors(errors); return null; }
    const spoken = forTimeline && hasTokens(d.text) ? String(d.fallback).trim() : previewLine(d, services.resolveTokens);
    const req = speechRequest(d, spoken);
    const key = JSON.stringify(req);
    if (last?.key === key) return last;
    ui.busy = true;
    draw();
    try {
      const out = await services.generate(req);
      last = { key, ...out };
      ui.errors = [];
      return last;
    } catch (err) {
      ui.errors = [err?.message || 'Voice generation failed'];
      return null;
    } finally {
      ui.busy = false;
      draw();
    }
  }

  function close() {
    ui.controller?.abort();
    player?.pause();
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
  }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  backdrop.addEventListener('input', (e) => {
    const k = e.target.dataset?.k;
    if (!k || k === 'voice') return;
    d[k] = ['speed', 'pitch'].includes(k) ? Number(e.target.value) : e.target.value;
    if (k === 'speed') backdrop.querySelector('[data-out="speed"]').textContent = `${Number(d.speed).toFixed(2)}×`;
    if (k === 'pitch') backdrop.querySelector('[data-out="pitch"]').textContent = `${d.pitch > 0 ? '+' : ''}${d.pitch}`;
    if (k === 'text' && !!backdrop.querySelector('[data-k="fallback"]') !== hasTokens(d.text)) { draw(); return; }
    if (k === 'text' || k === 'fallback') {
      const limit = k === 'fallback' ? LIMIT : hasTokens(d.text) ? PERSONAL_LIMIT : LIMIT;
      const out = backdrop.querySelector(`[data-out="${k}"]`);
      out.textContent = `${d[k].length}/${limit}`;
      out.classList.toggle('is-over', d[k].length > limit);
    }
  });

  // Remember where the cursor was in the text, so a token goes there even
  // after the Personalize voice menu redraws the window.
  backdrop.addEventListener('focusout', (e) => {
    if (e.target.dataset?.k === 'text') ui.caret = e.target.selectionStart;
  });

  backdrop.addEventListener('change', (e) => {
    if (e.target.dataset?.k === 'voice') { d.voice = e.target.value; draw(); }
    if (e.target.dataset?.contact) {
      const id = e.target.dataset.contact;
      if (e.target.checked) ui.selected.add(id); else ui.selected.delete(id);
      draw();
    }
    if (e.target.dataset?.all !== undefined) {
      const contacts = services.listContacts?.() || [];
      ui.selected = new Set(e.target.checked ? contacts.filter((c) => resolveLineFor(d.text, c)).map((c) => String(c.id)) : []);
      draw();
    }
  });

  backdrop.addEventListener('click', async (e) => {
    const t = e.target;
    if (t === backdrop || t.closest('.speech-modal__close')) { close(); return; }
    const tab = t.closest('[data-tab]')?.dataset.tab;
    if (tab) { if (ui.progress) return; ui.tab = tab; ui.view = 'form'; draw(); return; }
    const lib = t.closest('[data-lib]')?.dataset.lib;
    if (lib) { ui.libTab = lib; draw(); return; }
    const provider = t.closest('[data-provider]')?.dataset.provider;
    if (provider && provider !== d.provider) {
      d.provider = provider;
      d.voice = PROVIDER_SETTINGS[provider].defaultVoice;
      const [lo, hi] = PROVIDER_SETTINGS[provider].speed;
      d.speed = Math.max(lo, Math.min(hi, d.speed));
      ui.errors = [];
      draw();
      return;
    }
    const step = t.closest('[data-step]')?.dataset.step;
    if (step) {
      const list = voices();
      const i = list.findIndex(([id]) => id === d.voice);
      d.voice = list[(i + Number(step) + list.length) % list.length][0];
      draw();
      return;
    }
    const saved = t.closest('[data-saved]')?.dataset.saved;
    if (saved != null) {
      const v = loadSavedVoices(storage)[Number(saved)];
      if (v) Object.assign(d, { provider: v.provider, voice: v.voice, speed: v.speed ?? 1, pitch: v.pitch ?? 0, instructions: v.instructions || '' });
      draw();
      return;
    }
    const token = t.closest('[data-token]')?.dataset.token;
    if (token) {
      const pos = Math.min(ui.caret ?? d.text.length, d.text.length);
      const insert = `{{${token}}}`;
      d.text = `${d.text.slice(0, pos)}${insert}${d.text.slice(pos)}`;
      ui.tokenMenu = false;
      ui.caret = pos + insert.length;
      draw();
      const ta = backdrop.querySelector('[data-k="text"]');
      if (ta) { ta.focus(); ta.setSelectionRange(ui.caret, ui.caret); }
      return;
    }
    const play = t.closest('[data-play]')?.dataset.play;
    if (play && player) { player.src = play; player.play?.().catch(() => {}); return; }
    const use = t.closest('[data-use]')?.dataset.use;
    if (use) {
      const clip = (services.listClips?.() || []).find((c) => String(c.id) === use);
      if (clip?.tts) {
        Object.assign(d, { provider: clip.tts.provider, voice: clip.tts.voice, speed: clip.tts.speed ?? 1, pitch: clip.tts.pitch ?? 0, instructions: clip.tts.instructions || '', text: clip.tts.text || '', fallback: clip.tts.fallback || '' });
        ui.tab = 'create';
        draw();
      }
      return;
    }
    const act = t.closest('[data-act]')?.dataset.act;
    if (act === 'tokens') { ui.tokenMenu = !ui.tokenMenu; draw(); return; }
    if (act === 'save') {
      const v = voiceInfo(d.provider, d.voice);
      const name = (globalThis.prompt?.('Name this voice', `${v.name} ${Number(d.speed).toFixed(2)}×`) || '').trim().slice(0, 40);
      if (!name) return;
      saveVoice({ name, provider: d.provider, voice: d.voice, speed: d.speed, pitch: d.pitch, instructions: d.instructions }, storage);
      draw();
      services.toast?.(`Saved voice "${name}"`, 'success');
      return;
    }
    if (act === 'back') { ui.view = 'form'; ui.errors = []; draw(); return; }
    if (act === 'stop') { ui.controller?.abort(); return; }
    if (act === 'voice-all') { voiceAllAndAdd(); return; }
    if (act === 'add' && hasTokens(d.text)) {
      const errors = validateSpeech(d);
      if (errors.length) { setErrors(errors); return; }
      ui.view = 'contacts';
      ui.selected = null;
      ui.errors = [];
      draw();
      return;
    }
    if (act === 'preview' || act === 'add') {
      const audio = await ensureAudio(act === 'add');
      if (!audio) return;
      if (act === 'preview') {
        const el = backdrop.querySelector('.speech-modal__audio');
        if (el) { el.hidden = false; el.src = audio.url; el.play?.().catch(() => {}); }
      } else {
        const tts = ttsMeta(d);
        const label = tts.personalized ? tts.fallback : tts.text;
        services.add?.({ url: audio.url, duration: audio.duration, tts, name: `Speech: ${label.slice(0, 40)}${label.length > 40 ? '…' : ''}` });
        close();
      }
    }
  });

  draw();
  setTimeout(() => backdrop.querySelector('[data-k="text"]')?.focus({ preventScroll: true }), 0);
  return { el: backdrop, close, draft: d };
}
