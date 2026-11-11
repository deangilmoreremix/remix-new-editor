/**
 * Template Generator — Preview step player.
 *
 * The original opened the assembled project in an iframe player. Here the same
 * composition the "Add to Timeline" step will insert (buildPreviewFromState) is
 * played back directly: videos and images in order, each for its clip length.
 * No timeline state is touched.
 */

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
export function createPreviewPlayer(root, playlist, { captions = [] } = {}) {
  const host = root?.querySelector?.('#tg-player');
  if (!host || !playlist.length) return { destroy() {} };
  const video = host.querySelector('.tg-player__video');
  const image = host.querySelector('.tg-player__image');
  const captionEl = host.querySelector('.tg-player__caption');
  const toggleBtn = host.querySelector('[data-player="toggle"]');
  const fill = host.querySelector('.tg-player__fill');
  const timeEl = host.querySelector('.tg-player__time');
  const items = [...host.querySelectorAll('[data-player="item"]')];
  const total = playlist.reduce((n, p) => n + p.duration, 0);
  const starts = [];
  { let acc = 0; for (const p of playlist) { starts.push(acc); acc += p.duration; } }

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
    const cap = captions.find((c) => c.index === index);
    captionEl.hidden = !cap;
    captionEl.textContent = cap?.text || '';
    paint();
  };

  const paint = () => {
    const t = (starts[index] || 0) + Math.min(elapsed, playlist[index].duration);
    fill.style.width = `${Math.min(100, (t / total) * 100)}%`;
    timeEl.textContent = `${formatTime(t)} / ${formatTime(total)}`;
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

  return {
    destroy() {
      playing = false;
      cancelAnimationFrame(raf);
      host.removeEventListener('click', onClick);
      try { video.pause(); video.removeAttribute('src'); } catch { /* ignore */ }
    },
  };
}
