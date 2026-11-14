/**
 * Template Generator — Preview step player.
 *
 * The original opened the assembled project in an iframe player. Here the same
 * composition the "Add to Timeline" step will insert (buildPreviewFromState) is
 * played back directly: videos and images in order, each for its clip length.
 * No timeline state is touched.
 */

// The text on the video is drawn by the editor's own overlay renderer (the same fonts, outline, box and entrance the timeline gets), so the
// preview is what you will get, and a selected text can be moved and resized with the editor's drag handles.
import '../../../lib/editor/addons/overlayAddons.js';
import { buildOverlayElement, finishOverlayElement, destroyOverlayElement, playInAnimation } from '../../../lib/editor/addons/overlayRender.js';
import { attachDragResize } from '../../../lib/editor/addons/dragResize.js';
import { lowerThirdFrame, LOWER_THIRD_DEFAULTS } from '../../../lib/editor/addons/lowerThirds.js';
import '../../../../styles/timeline-addons.css';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const formatTime = (sec) => {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Playable items (video / image) of a preview descriptor, in start order. */
export function playlistFromPreview(preview) {
  const items = [];
  for (const track of preview?.tracks || []) {
    for (const clip of track.clips || []) {
      const src = clip.asset?.url;
      if ((clip.type === 'video' || clip.type === 'image') && src) {
        items.push({ type: clip.type, src, name: clip.name || 'Clip', duration: Math.max(1, Number(clip.duration) || 5), start: clip.startTime || 0, poster: clip.asset?.thumbnail || '' });
      }
    }
  }
  return items.sort((a, b) => a.start - b.start);
}

export function renderPlayerHTML(playlist) {
  if (!playlist.length) {
    return '<div class="tg-player tg-player--empty">Pick at least one video on the Video step to preview your template.</div>';
  }
  const total = playlist.reduce((n, p) => n + p.duration, 0);
  return `
    <div class="tg-player" id="tg-player">
      <div class="tg-player__screen">
        <video class="tg-player__video" playsinline muted preload="metadata" ${playlist[0].type === 'video' ? '' : 'hidden'}></video>
        <img class="tg-player__image" alt="" ${playlist[0].type === 'image' ? '' : 'hidden'}>
        <div class="tg-player__caption" hidden></div>
        <div class="tg-player__layer addon-overlay-layer" data-player="layer"></div>
      </div>
      <div class="tg-player__bar">
        <button type="button" class="tg-player__btn" data-player="toggle" aria-label="Play">▶</button>
        <div class="tg-player__track" data-player="seek"><div class="tg-player__fill"></div></div>
        <span class="tg-player__time">0:00 / ${formatTime(total)}</span>
      </div>
      <div class="tg-player__list">
        ${playlist.map((p, i) => `<button type="button" class="tg-player__item${i === 0 ? ' is-active' : ''}" data-player="item" data-index="${i}"><span>${esc(p.name)}</span><span>${formatTime(p.duration)}</span></button>`).join('')}
      </div>
    </div>`;
}

/** Wire a rendered player. Returns { destroy }. */
export function createPreviewPlayer(root, playlist, { captions = [], texts = null, onSelect, onChange } = {}) {
  const host = root?.querySelector?.('#tg-player');
  if (!host || !playlist.length) return { destroy() {} };
  const video = host.querySelector('.tg-player__video');
  const image = host.querySelector('.tg-player__image');
  const captionEl = host.querySelector('.tg-player__caption');
  const layer = host.querySelector('[data-player="layer"]');
  const screen = host.querySelector('.tg-player__screen');
  const toggleBtn = host.querySelector('[data-player="toggle"]');
  const fill = host.querySelector('.tg-player__fill');
  const timeEl = host.querySelector('.tg-player__time');
  const items = [...host.querySelectorAll('[data-player="item"]')];
  const total = playlist.reduce((n, p) => n + p.duration, 0);
  const starts = [];
  { let acc = 0; for (const p of playlist) { starts.push(acc); acc += p.duration; } }

  // ---- text on the video: drawn at the playhead, selectable, draggable ----
  let textItems = Array.isArray(texts) ? texts : null;     // null = the old one-caption-per-clip fallback
  let selectedRole = null;
  const mounted = new Map();                           // item id → { el, sig, detach }
  const sigOf = (t) => JSON.stringify([t.text, t.style, t.lowerThird, t.role === selectedRole]);
  const drop = (id) => { const m = mounted.get(id); if (!m) return; try { m.detach?.(); } catch { /* ignore */ } destroyOverlayElement(m.el); mounted.delete(id); };
  const buildFor = (t) => {
    const lt = t.lowerThird;
    const clip = lt
      ? { id: t.id, type: 'overlay-lower-third', addon: { ...LOWER_THIRD_DEFAULTS, template: lt.template, name: lt.name || '', title: lt.title || '' } }
      : { id: t.id, type: 'overlay-text', addon: { ...t.style, text: t.text } };
    const el = buildOverlayElement(clip, { editor: false });
    return { el, clip };
  };
  const renderTexts = (now) => {
    if (!textItems || !layer) return;
    layer.style.setProperty('--ovl-w', `${layer.clientWidth || 640}px`);
    layer.style.setProperty('--ovl-h', `${layer.clientHeight || 360}px`);
    const active = textItems.filter((t) => now >= t.start - 1e-6 && now < t.start + Math.max(t.duration, 0.1));
    for (const id of [...mounted.keys()]) if (!active.some((t) => t.id === id)) drop(id);
    for (const t of active) {
      const have = mounted.get(t.id);
      const sig = sigOf(t);
      if (have && have.sig === sig) {
        if (t.lowerThird && have.el._lottie) have.el._lottie.goToAndStop(lowerThirdFrame(now - t.start, t.duration), true);
        continue;
      }
      if (have) drop(t.id);
      const built = buildFor(t);
      if (!built.el) continue;
      layer.appendChild(built.el);
      const entry = { el: built.el, sig, detach: null };
      mounted.set(t.id, entry);
      built.el.style.cursor = 'pointer';
      built.el.addEventListener('pointerdown', () => { if (selectedRole !== t.role) { selectedRole = t.role; pause(); onSelect?.(t.role); renderTexts(now); } });
      void finishOverlayElement(built.el).then(() => { if (t.lowerThird && built.el._lottie) built.el._lottie.goToAndStop(lowerThirdFrame(now - t.start, t.duration), true); });
      if (t.lowerThird) built.el._pendingFrame = lowerThirdFrame(now - t.start, t.duration);
      else if (!selectedRole) playInAnimation(built.el, t.style?.animation);
      if (t.role === selectedRole && !t.lowerThird && t.style?.geometry) {
        entry.detach = attachDragResize(built.el, layer, { geometry: t.style.geometry, onCommit: (g) => onChange?.(t.role, { geometry: g }) });
      }
    }
  };
  screen?.addEventListener('pointerdown', (e) => { if (e.target === screen || e.target.classList?.contains('tg-player__video') || e.target === layer) { if (selectedRole) { selectedRole = null; onSelect?.(null); renderTexts(timeNow()); } } });

  let index = 0;
  let elapsed = 0; // seconds into the current clip
  let playing = false;
  let raf = 0;
  let last = 0;

  const show = (i) => {
    index = Math.max(0, Math.min(playlist.length - 1, i));
    elapsed = 0;
    const clip = playlist[index];
    if (clip.type === 'video') {
      image.hidden = true;
      video.hidden = false;
      if (video.getAttribute('src') !== clip.src) video.src = clip.src;
      try { video.currentTime = 0; } catch { /* metadata not loaded yet */ }
    } else {
      try { video.pause(); } catch { /* ignore */ }
      video.hidden = true;
      image.hidden = false;
      image.src = clip.src;
    }
    items.forEach((el, n) => el.classList.toggle('is-active', n === index));
    if (!textItems) {
      const cap = captions.find((c) => c.index === index);
      captionEl.hidden = !cap;
      captionEl.textContent = cap?.text || '';
    } else captionEl.hidden = true;
    paint();
  };
  const timeNow = () => (starts[index] || 0) + Math.min(elapsed, playlist[index].duration);

  const paint = () => {
    const t = (starts[index] || 0) + Math.min(elapsed, playlist[index].duration);
    fill.style.width = `${Math.min(100, (t / total) * 100)}%`;
    timeEl.textContent = `${formatTime(t)} / ${formatTime(total)}`;
    renderTexts(t);
    toggleBtn.textContent = playing ? '❚❚' : '▶';
    toggleBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  };

  const tick = (ts) => {
    if (!playing) return;
    elapsed += (ts - last) / 1000;
    last = ts;
    if (elapsed >= playlist[index].duration) {
      if (index < playlist.length - 1) { show(index + 1); if (playlist[index].type === 'video') video.play?.().catch(() => {}); }
      else { pause(); show(0); return; }
    }
    paint();
    raf = requestAnimationFrame(tick);
  };

  const play = () => {
    if (playing) return;
    playing = true;
    last = performance.now();
    if (playlist[index].type === 'video') video.play?.().catch(() => {});
    raf = requestAnimationFrame(tick);
    paint();
  };
  const pause = () => {
    playing = false;
    cancelAnimationFrame(raf);
    try { video.pause(); } catch { /* ignore */ }
    paint();
  };

  const onClick = (e) => {
    const btn = e.target.closest?.('[data-player]');
    if (!btn || !host.contains(btn)) return;
    const kind = btn.dataset.player;
    if (kind === 'toggle') (playing ? pause : play)();
    else if (kind === 'item') { const was = playing; pause(); show(Number(btn.dataset.index)); if (was) play(); }
    else if (kind === 'seek') {
      const r = btn.getBoundingClientRect();
      const t = ((e.clientX - r.left) / Math.max(1, r.width)) * total;
      let i = starts.findIndex((s, n) => t >= s && t < s + playlist[n].duration);
      if (i < 0) i = playlist.length - 1;
      const was = playing; pause(); show(i); elapsed = Math.max(0, t - starts[i]); paint(); if (was) play();
    }
  };
  host.addEventListener('click', onClick);
  show(0);

  /** Jump the playhead to time t (seconds) and show that moment. */
  const seek = (t) => {
    let i = starts.findIndex((st, n) => t >= st && t < st + playlist[n].duration);
    if (i < 0) i = playlist.length - 1;
    const was = playing; pause(); show(i); elapsed = Math.max(0, t - starts[i]);
    try { if (playlist[i].type === 'video') video.currentTime = elapsed; } catch { /* metadata not loaded yet */ }
    paint(); if (was) play();
  };

  return {
    /** Replace the texts (after an edit) and redraw them at the current moment. */
    setTexts(next) { textItems = Array.isArray(next) ? next : null; for (const id of [...mounted.keys()]) drop(id); paint(); },
    /** Select a text role: pause, jump to where it first shows, and give it handles. */
    selectRole(role) {
      selectedRole = role || null;
      if (role && textItems) { const t = textItems.find((x) => x.role === role); if (t) { pause(); seek(t.start + 0.05); } }
      for (const id of [...mounted.keys()]) drop(id);
      paint();
    },
    seek,
    destroy() {
      for (const id of [...mounted.keys()]) drop(id);
      playing = false;
      cancelAnimationFrame(raf);
      host.removeEventListener('click', onClick);
      try { video.pause(); video.removeAttribute('src'); } catch { /* ignore */ }
    },
  };
}
