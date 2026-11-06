/**
 * Public interactive video player: /watch/<id>  (embed: /watch/<id>?embed=1)
 *
 * Plays a video published from the timeline editor, with its interactive
 * elements (pause, loop, skip, lead forms, CTA buttons, List Builder /
 * Personalizer). No sign-in. Personalized links fill {{tokens}} from the
 * query string, e.g. /watch/<id>?firstname=Ann&company=Acme.
 */
import '../../styles/timeline-addons.css';
import '../../styles/watch.css';
import { fetchPublishedVideo, countView, submitViewerLead, profileFromQuery, recordVideoEvent } from '../lib/editor/publish/publishClient.js';
import { fetchPersonalVoice, usesAiVoice } from '../lib/editor/publish/personalVoice.js';
import { createInteractivePlayer } from '../lib/editor/publish/interactivePlayer.js';

const FPS = 30;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (s) => {
  const t = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

function message(container, title, text) {
  container.innerHTML = `<main class="watch watch--message"><div class="watch-msg"><h1>${esc(title)}</h1><p>${esc(text)}</p></div></main>`;
}

/**
 * @param {HTMLElement} container
 * @param {string} id
 * @param {object} deps  (tests) { fetchVideo, createEngine, onLead, countView }
 */
export async function mountWatchPage(container, id, deps = {}) {
  const params = new URLSearchParams(globalThis.location?.search || '');
  const embed = params.get('embed') === '1';
  document.documentElement.classList.add('watch-root');
  if (embed) document.documentElement.classList.add('watch-embed');
  container.innerHTML = '<main class="watch"><div class="watch-msg" role="status"><div class="watch-spinner" aria-hidden="true"></div><p>Loading video…</p></div></main>';

  let video;
  try {
    video = await (deps.fetchVideo || fetchPublishedVideo)(id);
  } catch (err) {
    message(container, 'Video unavailable', err?.message || 'Please try again later.');
    return null;
  }
  if (!video?.project?.tracks) {
    message(container, 'Video not found', 'This video was removed or is no longer shared.');
    return null;
  }
  const title = video.title || video.project.title || 'Video';
  document.title = title;

  container.innerHTML = `
    <main class="watch">
      ${embed ? '' : `<header class="watch-head"><h1>${esc(title)}</h1></header>`}
      <section class="watch-player" aria-label="${esc(title)}">
        <div class="watch-frame" data-frame>
          <div class="watch-stage" data-stage></div>
          <button type="button" class="watch-bigplay" data-bigplay aria-label="Play video"><span aria-hidden="true">▶</span></button>
          ${usesAiVoice(video.project) ? '<span class="watch-ai-voice" title="The voice in this video is AI-generated">AI-generated voice</span>' : ''}
        </div>
        <div class="watch-controls">
          <button type="button" class="watch-btn" data-play aria-label="Play">▶</button>
          <span class="watch-time" data-time>0:00</span>
          <input type="range" class="watch-seek" data-seek min="0" max="1000" value="0" step="1" aria-label="Seek"/>
          <span class="watch-time" data-dur>0:00</span>
          <button type="button" class="watch-btn" data-fs aria-label="Full screen">⛶</button>
        </div>
      </section>
    </main>`;
  const $ = (s) => container.querySelector(s);
  const frame = $('[data-frame]');

  const createEngine = deps.createEngine || await (async () => {
    const { createPreviewEngine } = await import('../lib/editor/remotion/previewEngine.jsx');
    return createPreviewEngine;
  })();

  let codePreview = null;
  let scrubbing = false;
  // Per-contact analytics (personal links carry ?c=<contactId>).
  const viewerProfile = profileFromQuery();
  const track = (kind, clipId = null) => (deps.recordEvent || recordVideoEvent)(video.id, { kind, contactId: viewerProfile?.id || null, clipId });
  let playedOnce = false;
  let completedOnce = false;
  const player = createInteractivePlayer({
    project: video.project,
    stage: $('[data-stage]'),
    frame,
    createEngine,
    profile: viewerProfile,
    fps: FPS,
    voiceFor: (clip, profile) => (deps.voiceFor || fetchPersonalVoice)({ publishedId: video.id, clip, profile }),
    onLead: async ({ clipId, kind, data }) => {
      const res = await (deps.onLead || submitViewerLead)({ publishedId: video.id, clipId, kind, data });
      if (kind !== 'call-attempt' && res?.stored !== false) track('lead', clipId);
      return res;
    },
    onChange: ({ playing, time, duration, gating }) => {
      if (playing && !playedOnce) { playedOnce = true; track('play'); }
      if (!completedOnce && duration > 0 && time >= duration - 0.3) { completedOnce = true; track('complete'); }
      $('[data-play]').textContent = playing ? '❚❚' : '▶';
      $('[data-play]').setAttribute('aria-label', playing ? 'Pause' : 'Play');
      // The big play button never covers a form the viewer must fill in.
      $('[data-bigplay]').hidden = playing || time > 0.05 || !!gating;
      $('[data-time]').textContent = fmt(time);
      $('[data-dur]').textContent = fmt(duration);
      if (!scrubbing) $('[data-seek]').value = String(Math.round((time / Math.max(0.001, duration)) * 1000));
      codePreview?.frame(Math.round(time * FPS));
    },
  });
  frame.style.aspectRatio = `${player.model.width} / ${player.model.height}`;
  $('[data-dur]').textContent = fmt(player.duration);

  // AI animations play in their own sandboxed frame over the video.
  if (player.model.layers.some((l) => l.kind === 'code') && !deps.createEngine) {
    import('../lib/editor/remotion/codePreviewClient.js').then(({ createCodePreview }) => {
      codePreview = createCodePreview(frame);
      codePreview.update(player.model);
    });
  }

  const start = () => { player.play(); };
  $('[data-bigplay]').addEventListener('click', start);
  $('[data-play]').addEventListener('click', () => player.toggle());
  const seekInput = $('[data-seek]');
  seekInput.addEventListener('input', () => {
    scrubbing = true;
    player.seek((Number(seekInput.value) / 1000) * player.duration);
  });
  seekInput.addEventListener('change', () => { scrubbing = false; });
  $('[data-fs]').addEventListener('click', () => {
    const el = $('.watch-player');
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  });
  container.addEventListener('keydown', (e) => {
    if (e.target.closest('input:not([data-seek]), textarea, select, form')) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); player.toggle(); }
    else if (e.key === 'ArrowRight') player.seek(player.time + 5);
    else if (e.key === 'ArrowLeft') player.seek(player.time - 5);
  });
  frame.addEventListener('click', (e) => {
    // Clicking the picture toggles playback (not when clicking a form, button or link).
    if (e.target === frame || e.target.closest('[data-stage]')) player.toggle();
  });

  // CTA buttons and links in the video (click-to-call, Smart Text links…).
  frame.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || !frame.contains(a)) return;
    track('cta_click', a.closest('[data-clip-id]')?.dataset.clipId || null);
  }, true);

  (deps.countView || countView)(video.id);
  track('view');
  return player;
}
