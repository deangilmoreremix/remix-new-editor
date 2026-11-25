// Click-to-play demo player for the landing page.
//
// Shows a poster and a play button. Nothing is downloaded until the visitor
// clicks (no preload, no autoplay), then a real <video controls> replaces the
// poster and plays with sound controls available. Used by the Product Demo and
// Studio Demos sections.
import GUIDE_VIDEOS from '../../../data/guideVideos.json';

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Tour video URLs for a studio slug, or null when it has no tour. */
export function tourFor(slug) {
  const t = GUIDE_VIDEOS.studios?.[slug];
  if (!t) return null;
  const base = `${GUIDE_VIDEOS.base}/${slug}`;
  return { seconds: t.seconds, mp4: `${base}/tour.mp4`, poster: `${base}/poster.webp`, captions: `${base}/captions.vtt` };
}

const PLAY_ICON = '<svg class="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

/**
 * @param {object} o
 * @param {string} o.label       accessible name of the video
 * @param {string} o.poster      poster image URL
 * @param {string} [o.fallbackPoster] used if the poster fails to load
 * @param {string} o.src         mp4 URL
 * @param {string} [o.captions]  WebVTT URL (adds a default captions track)
 * @param {string} [o.className] extra classes for the frame
 * @param {string} [o.onPlay]    called once when the visitor starts the video
 */
export function createDemoPlayer({ label, poster, fallbackPoster, src, captions, className = '', onPlay }) {
  const frame = document.createElement('div');
  frame.className = `demo-player relative overflow-hidden bg-black aspect-video ${className}`.trim();
  frame.setAttribute('data-demo-player', '');

  const img = document.createElement('img');
  img.src = poster;
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.className = 'absolute inset-0 w-full h-full object-cover';
  if (fallbackPoster) {
    img.addEventListener('error', () => { if (!img.src.endsWith(fallbackPoster)) img.src = fallbackPoster; }, { once: true });
  }
  frame.appendChild(img);

  const btn = document.createElement('button');
  btn.type = 'button';
  // The app's outline-buttons rule blurs and unfills every button; this overlay is a picture tile, so opt out.
  btn.setAttribute('data-keep-fill', '');
  btn.style.backdropFilter = 'none';
  btn.style.webkitBackdropFilter = 'none';
  btn.setAttribute('aria-label', `Play video: ${label}`);
  btn.className = 'absolute inset-0 w-full h-full flex items-center justify-center bg-black/30 hover:bg-black/15 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-inset';
  btn.innerHTML = `<span class="w-20 h-20 rounded-full bg-cyan-400 text-[#020205] flex items-center justify-center shadow-2xl shadow-cyan-400/40 group-hover:scale-110 transition-transform">${PLAY_ICON}</span>`;
  frame.appendChild(btn);

  let video = null;
  const start = () => {
    if (video) return;
    video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-label', label);
    video.className = 'absolute inset-0 w-full h-full bg-black';
    video.src = src;
    if (captions) {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.label = 'English';
      track.srclang = 'en';
      track.src = captions;
      track.default = true;
      video.appendChild(track);
    }
    frame.replaceChildren(video);
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
    if (onPlay) onPlay();
  };
  btn.addEventListener('click', start);

  /** Stop playback and return to the poster state (used when switching videos or leaving the page). */
  frame.stop = () => { if (video) video.pause(); };
  return frame;
}
