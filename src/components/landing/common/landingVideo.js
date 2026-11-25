// Landing product videos: real captures of the running app, rendered silent.
// Files live in /public/landing-videos/<name>.mp4 (+ .poster.webp, hero also .webm).
//
// Behaviour:
//  - autoplay, muted, loop, playsInline, preload="metadata", poster image
//  - below-the-fold videos load their sources only when scrolled near (IntersectionObserver)
//    and pause when off screen
//  - prefers-reduced-motion: renders the poster image only, never a <video>

const BASE = '/landing-videos/';

export function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function createLandingVideo({ name, label, eager = false, webm = false, className = '' }) {
  const wrap = document.createElement('div');
  wrap.className = `landing-video relative overflow-hidden bg-black ${className}`.trim();
  wrap.setAttribute('data-landing-video', name);
  const poster = `${BASE}${name}.poster.webp`;

  if (prefersReducedMotion()) {
    const img = document.createElement('img');
    img.src = poster;
    img.alt = label;
    img.loading = eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    img.className = 'w-full h-full object-cover';
    wrap.appendChild(img);
    return wrap;
  }

  const v = document.createElement('video');
  v.muted = true;
  v.defaultMuted = true;
  v.loop = true;
  v.playsInline = true;
  v.autoplay = true;
  v.preload = 'metadata';
  v.poster = poster;
  v.setAttribute('muted', '');
  v.setAttribute('playsinline', '');
  v.setAttribute('role', 'img');
  v.setAttribute('aria-label', label);
  v.disablePictureInPicture = true;
  v.className = 'w-full h-full object-cover';
  wrap.appendChild(v);

  let attached = false;
  const attach = () => {
    if (attached) return;
    attached = true;
    if (webm) {
      const s = document.createElement('source');
      s.src = `${BASE}${name}.webm`;
      s.type = 'video/webm';
      v.appendChild(s);
    }
    const s = document.createElement('source');
    s.src = `${BASE}${name}.mp4`;
    s.type = 'video/mp4';
    v.appendChild(s);
    v.load();
  };
  const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };

  if (eager || typeof IntersectionObserver === 'undefined') {
    attach();
    play();
  }
  if (typeof IntersectionObserver !== 'undefined') {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { attach(); play(); } else if (attached) { v.pause(); }
      });
    }, { rootMargin: '200px 0px' });
    io.observe(wrap);
  }
  return wrap;
}

/** Replace every <div data-lv-slot data-lv-name=".." data-lv-label=".."> under root with a landing video. */
export function mountLandingVideos(root) {
  root.querySelectorAll('[data-lv-slot]').forEach((slot) => {
    const vid = createLandingVideo({
      name: slot.getAttribute('data-lv-name'),
      label: slot.getAttribute('data-lv-label') || '',
      eager: slot.hasAttribute('data-lv-eager'),
      webm: slot.hasAttribute('data-lv-webm'),
      className: slot.className,
    });
    slot.replaceWith(vid);
  });
}

/** Slot markup for string-template sections. */
export function videoSlot(name, label, { eager = false, webm = false, className = 'aspect-video rounded-lg border border-white/10' } = {}) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<div data-lv-slot data-lv-name="${esc(name)}" data-lv-label="${esc(label)}"${eager ? ' data-lv-eager' : ''}${webm ? ' data-lv-webm' : ''} class="${className}"></div>`;
}
