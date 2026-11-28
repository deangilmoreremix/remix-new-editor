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
import { fetchPublishedVideo, canonicalUrl, submitViewerLead, profileFromQuery, profileFromLink, personalLinkIdFromQuery, fetchPersonalization } from '../lib/editor/publish/publishClient.js';
import { createAnalytics, consentMode } from '../lib/editor/publish/analyticsClient.js';
import { projectSections, ctaLabels, isPricingLabel } from '../lib/editor/publish/sections.js';
import { fetchPersonalVoice, usesAiVoice } from '../lib/editor/publish/personalVoice.js';
import { createHeatmapCapture, singleLeadClipId } from '../lib/editor/publish/heatmapCapture.js';
import { createInteractivePlayer } from '../lib/editor/publish/interactivePlayer.js';
import { fillTemplate, calendarEmbedUrl } from '../lib/outreach/draft.js';
import { cleanTranscript, clock } from '../lib/outreach/transcript.js';
import { searchLines, highlightPieces } from '../lib/outreach/transcriptSearch.js';
import { captureEarlyPlay } from '../lib/editor/publish/earlyPlay.js';
import { pickVariant } from '../lib/editor/addons/abTest.js';
import { trackersFor, fireLeadTrackers } from '../lib/editor/publish/pixel.js';
import { captureAttribution } from '../lib/editor/publish/attribution.js';

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
 * @param {string|{business:string,slug:string}} ref  a video id (/watch/<id>) or a readable link (/v/<business>/<slug>)
 * @param {object} deps  (tests) { fetchVideo, createEngine, onLead, analytics, attribution }
 */
// Reading localStorage itself can throw (storage blocked): then there is simply no storage.
const browserStorage = () => { try { return globalThis.localStorage; } catch { return null; } };

async function startLiveCalls({ button, videoId, contactId, host, analytics, player, container }) {
  const { liveCallSupported, createGuestLine } = await import('../lib/outreach/liveCall.js');
  if (!liveCallSupported()) return;
  const { createCallWindow } = await import('../components/outreach/LiveCallPanel.js');
  const label = button.querySelector('[data-live-label]');
  let win = null;
  let who = host;
  const line = createGuestLine({
    videoId,
    contactId,
    onUpdate: (st) => {
      who = st.hostName || host || 'us';
      const free = st.hostOnline && (st.phase === 'idle' || ['missed', 'declined', 'ended', 'failed'].includes(st.phase));
      const inCall = ['ringing', 'connecting', 'live'].includes(st.phase);
      button.hidden = !st.hostOnline && !inCall;
      button.disabled = !free;
      label.textContent = st.error || (st.hostOnline ? `Talk live with ${who} now` : `${who} is away`);
      if (win) win.update(st);
      if (['missed', 'declined', 'failed'].includes(st.phase)) {
        // Offer the booking button instead.
        container.querySelector('[data-landing-cta]')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      }
    },
  });
  button.addEventListener('click', () => {
    if (button.disabled) return;
    try { player?.pause?.(); } catch { /* the call still starts */ }
    win?.destroy();
    win = createCallWindow({ who, onHangup: () => line.hangup(), onClose: () => { win = null; } });
    analytics?.track?.('overlay_click', { t: player?.time, props: { label: 'Talk live' } });
    line.call();
  });
  globalThis.addEventListener?.('pagehide', () => { line.destroy(); win?.destroy(); }, { once: true });
}

export async function mountWatchPage(container, ref, deps = {}) {
  const params = new URLSearchParams(globalThis.location?.search || '');
  const embed = params.get('embed') === '1';
  document.documentElement.classList.add('watch-root');
  if (embed) document.documentElement.classList.add('watch-embed');
  container.innerHTML = '<main class="watch"><div class="watch-msg" role="status"><div class="watch-spinner" aria-hidden="true"></div><p>Loading video…</p></div></main>';

  let video;
  try {
    video = await (deps.fetchVideo || fetchPublishedVideo)(ref);
    // A renamed link answers with its new address: follow it, keep the query string.
    if (video?.redirect?.id) {
      const r = video.redirect;
      const target = r.business && r.slug ? { business: r.business, slug: r.slug } : r.id;
      video = await (deps.fetchVideo || fetchPublishedVideo)(target);
    }
  } catch (err) {
    message(container, 'Video unavailable', err?.message || 'Please try again later.');
    return null;
  }
  if (!video?.project?.tracks) {
    message(container, 'Video not found', 'This video was removed or is no longer shared.');
    return null;
  }
  // The viewer's details: a stored personal link (?p=<id>, values kept on the server and not editable in the
  // address), else the details carried in the address (?c=…&firstname=…). A personal link that is unknown,
  // revoked or for another video is not played unpersonalized — the sender gave it to someone specific.
  const linkId = personalLinkIdFromQuery();
  let viewerProfile;
  if (linkId) {
    let stored;
    try {
      stored = await (deps.fetchPersonalization || fetchPersonalization)(linkId);
    } catch (err) {
      message(container, 'Video unavailable', err?.message || 'Please try again later.');
      return null;
    }
    if (!stored || stored.videoId !== video.id) {
      message(container, 'This link is no longer active', 'Ask the person who sent it for a new link.');
      return null;
    }
    viewerProfile = profileFromLink(stored);
  } else {
    viewerProfile = profileFromQuery();
  }
  const title = video.title || video.project.title || 'Video';
  document.title = title;
  // Unlisted videos are reachable by link only: keep them out of search results.
  if (video.privacy === 'unlisted') {
    const m = document.createElement('meta');
    m.name = 'robots';
    m.content = 'noindex, nofollow';
    document.head.appendChild(m);
  }
  // Show the canonical address (readable link when set) without reloading.
  try {
    const canon = new URL(canonicalUrl(video, globalThis.location?.origin || ''));
    if (canon.pathname !== globalThis.location?.pathname && globalThis.history?.replaceState) {
      globalThis.history.replaceState(null, '', canon.pathname + (globalThis.location?.search || ''));
    }
  } catch { /* non-browser env */ }

  // Video Outreach campaigns carry landing text: a header and message filled with the viewer's
  // details from their personal link (fallbacks when missing) and a booking button.
  const landing = video.project.landing && typeof video.project.landing === 'object' ? video.project.landing : null;
  const linkValues = profileFromQuery()?.variables || {};
  const fill = (text) => fillTemplate(text, linkValues, landing?.fallbacks || {});
  const heading = landing?.header ? fill(landing.header) || title : title;
  // Button text test: a second wording, chosen at random per viewer. Remembered in the browser only for the full tracking
  // mode, so a returning viewer sees the same one; in the other modes nothing is stored (a new pick each visit).
  const ctaLabelA = String(landing?.cta?.label || '');
  const ctaLabelB = String(landing?.cta?.labelB || '');
  const ctaShown = ctaLabelB && ctaLabelA ? (pickVariant(`cta:${video.id}`, { storage: consentMode() === 'full' ? browserStorage() : null }) === 'B' ? ctaLabelB : ctaLabelA) : ctaLabelA;
  const ctaHref = (() => { try { const u = new URL(String(landing?.cta?.url || '')); return u.protocol === 'https:' ? u.toString() : null; } catch { return null; } })();
  // The booking page itself, shown under the button, for known calendar hosts only.
  const calendarSrc = landing?.cta?.embed && ctaHref ? calendarEmbedUrl(ctaHref) : null;
  // "Talk live" (src/lib/outreach/liveCall.js): the button shows only while the sender is available.
  const liveOn = !!(landing?.live && !embed);
  const hasActions = !!(landing && !embed && ((ctaHref && ctaShown) || liveOn));
  // The row under the player: Talk live (while the sender is available) and the booking button.
  const landingBody = hasActions
    ? `<section class="watch-landing watch-actions" aria-label="Next step">
        ${liveOn ? `<button type="button" class="watch-live-btn" data-live-call hidden><span class="watch-live-dot" aria-hidden="true"></span><span data-live-label>Talk live now</span></button>` : ''}
        ${ctaHref && ctaShown ? `<a class="watch-landing-cta" data-landing-cta href="${esc(ctaHref)}" target="_blank" rel="noopener noreferrer">${esc(ctaShown)}</a>` : ''}
      </section>`
    : '';
  // The booking page itself, right under the player, with a plain title.
  const calendarBody = calendarSrc && !embed
    ? `<section class="watch-calendar" aria-labelledby="watch-calendar-title">
        <h2 id="watch-calendar-title">Pick a time that suits you</h2>
        <iframe class="watch-landing-calendar" data-landing-calendar src="${esc(calendarSrc)}" title="${esc(ctaShown || 'Book a time')}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"></iframe>
      </section>`
    : '';
  // Who the page is from (sender details when the campaign carries them): brand row on top, credit in the footer.
  const sender = landing?.sender && typeof landing.sender === 'object' ? landing.sender : {};
  const brand = String(sender.company || sender.name || video.project.campaign?.name || '').trim().slice(0, 80);
  const logoUrl = (() => { try { const u = new URL(String(sender.logo || '')); return u.protocol === 'https:' ? u.toString() : ''; } catch { return ''; } })();
  // Plain words about what this page records, matching what the analytics client really does (analyticsClient.js).
  const recordMode = consentMode();
  const personalLink = Boolean(viewerProfile?.id); // a stored link (?p=) or one with a contact in the address (?c=)
  const privacyNote = `<details class="watch-privacy" data-privacy>
          <summary>What this page records</summary>
          <p>${recordMode === 'off'
    ? 'Tracking is off for this visit (your browser or this link asks for that), so nothing about your visit is recorded.'
    : `The sender can see that this page was opened, whether the video was played and how far, and which buttons were clicked. ${personalLink ? ' Because this link was made for you, they can tell it was you.' : ''}${recordMode === 'anonymous' ? ' No tracking code is kept in your browser. A video with a sign-up form or a version test may still remember in your browser that you filled the form in or which version you saw.' : ' A random code is kept in your browser so a return visit is recognised; it is not your name or email.'} Nothing is recorded if your browser sends Do Not Track or Global Privacy Control.`}</p>
        </details>`;
  const brandRow = !embed && (brand || logoUrl)
    ? `<div class="watch-brand">${logoUrl ? `<img class="watch-brand-logo" src="${esc(logoUrl)}" alt="" />` : brand ? `<span class="watch-brand-mark" aria-hidden="true">${esc(brand.charAt(0).toUpperCase())}</span>` : ''}${brand ? `<span class="watch-brand-name">${esc(brand)}</span>` : ''}</div>`
    : '';
  const intro = landing && !embed && landing.message ? `<p class="watch-landing-msg">${esc(fill(landing.message))}</p>` : '';

  // The transcript (Video Outreach captions), under the video: each line jumps the video to its moment, the line
  // being spoken is highlighted, and translations can be picked. Not in the embedded player.
  const transcript = embed ? null : cleanTranscript(video.project.transcript);
  const LANG_NAMES = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian', nl: 'Dutch', ja: 'Japanese', ko: 'Korean', zh: 'Chinese', hi: 'Hindi', ar: 'Arabic' };
  const transcriptLangs = transcript ? [transcript.lang, ...Object.keys(transcript.translations)] : [];
  const transcriptBody = transcript
    ? `<section class="watch-transcript" data-transcript>
        <div class="watch-transcript-head">
          <h2>Transcript</h2>
          ${transcriptLangs.length > 1 ? `<select data-transcript-lang aria-label="Transcript language">${transcriptLangs.map((c) => `<option value="${esc(c)}">${esc(LANG_NAMES[c] || c)}</option>`).join('')}</select>` : ''}
        </div>
        <div class="watch-transcript-search">
          <input type="search" class="watch-transcript-q" data-transcript-q placeholder="Search the transcript" aria-label="Search the transcript" autocomplete="off" enterkeyhint="search" />
          <p class="watch-transcript-count" data-transcript-count role="status" aria-live="polite"></p>
        </div>
        <ol class="watch-transcript-lines" data-transcript-lines></ol>
      </section>`
    : '';

  // Chapters (made in the Video Outreach editor from the captions): click one to jump there.
  const chapters = embed ? [] : (Array.isArray(video.project.chapters) ? video.project.chapters : [])
    .filter((c) => Number.isFinite(c?.startMs) && typeof c.title === 'string' && c.title.trim()).slice(0, 20);
  const chaptersBody = chapters.length > 1
    ? `<nav class="watch-chapters" data-chapters aria-label="Chapters"><h2>Chapters</h2><ol>${chapters.map((c, i) => `<li><button type="button" class="watch-chapter" data-chapter="${i}"><span class="watch-transcript-time">${esc(clock(c.startMs))}</span><span>${esc(c.title)}</span></button></li>`).join('')}</ol></nav>`
    : '';

  const playerBody = `<section class="watch-player" aria-label="${esc(title)}">
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
      </section>`;
  const sideBody = chaptersBody || transcriptBody ? `<aside class="watch-side">${chaptersBody}${transcriptBody}</aside>` : '';
  container.innerHTML = embed
    ? `<main class="watch">${playerBody}</main>`
    : `<main class="watch">
      <div class="watch-page">
        <header class="watch-head">
          ${brandRow}
          <h1>${esc(heading)}</h1>
          ${intro}
        </header>
        <div class="watch-layout${sideBody ? ' watch-layout--side' : ''}">
          <div class="watch-main">
            ${playerBody}
            ${landingBody}
            ${calendarBody}
          </div>
          ${sideBody}
        </div>
        ${brand ? `<footer class="watch-foot">Video message by <strong>${esc(brand)}</strong></footer>` : ''}
        ${embed ? '' : privacyNote}
      </div>
    </main>`;
  const $ = (s) => container.querySelector(s);
  const frame = $('[data-frame]');
  const early = captureEarlyPlay(container); // a Play pressed before the player is wired is kept and released below

  const createEngine = deps.createEngine || await (async () => {
    const { createPreviewEngine } = await import('../lib/editor/remotion/previewEngine.jsx');
    return createPreviewEngine;
  })();

  let codePreview = null;
  let scrubbing = false;
  // Per-contact analytics (a personal link knows its contact).
  // Campaign tags + referrer, captured once when the page loads (first touch) and sent with each lead.
  const attribution = deps.attribution ?? captureAttribution();
  // First-party analytics (netlify/functions/video-events.js): batched, idempotent,
  // consent-aware. Playback milestones / watch time come from onChange below.
  const analytics = deps.analytics || createAnalytics({
    videoId: video.id,
    contactId: viewerProfile?.id || null,
    recipientToken: params.get('cr') || null, // campaign recipient link (?cr=<public_token>), validated server-side
    sections: projectSections(video.project).map((x) => ({ id: x.id, start: x.start, end: x.end })),
  });
  const labels = ctaLabels(video.project);
  const labelFor = (clipId) => (clipId != null ? labels[String(clipId)] || null : null);
  // Stage 7 heatmap capture (clicks, CTA impressions, scroll depth, per-second watch buckets); inert when analytics is off.
  const heat = deps.heatmap || createHeatmapCapture({ analytics, container, frame, labelFor, leadClipId: singleLeadClipId(video.project) });
  const player = createInteractivePlayer({
    project: video.project,
    stage: $('[data-stage]'),
    frame,
    createEngine,
    profile: viewerProfile,
    rememberKey: video.id,
    fps: FPS,
    voiceFor: (clip, profile) => (deps.voiceFor || fetchPersonalVoice)({ publishedId: video.id, clip, profile }),
    onLead: async ({ clipId, kind, data, signals, variant }) => {
      // The viewing session (null when analytics is off or the viewer opted out) lets the owner see how much of the video a lead watched.
      const res = await (deps.onLead || submitViewerLead)({ publishedId: video.id, clipId, kind, data, attribution, signals, variant, session: analytics.sessionId || null });
      if (kind !== 'call-attempt' && res?.stored !== false) {
        analytics.track('lead_submit', { clip: clipId, props: labelFor(clipId) ? { label: labelFor(clipId) } : undefined });
        if (!deps.onLead) fireLeadTrackers(trackersFor(video.project, kind, clipId));
      }
      return res;
    },
    // A viewer clicked a hotspot: its own event type (not a CTA click), labelled with the owner's text.
    onHotspot: ({ clip, label, time }) => analytics.track('overlay_click', { clip: String(clip.id), t: time, props: (label || labelFor(String(clip.id))) ? { label: label || labelFor(String(clip.id)) } : undefined }),
    onChange: ({ playing, time, duration, gating }) => {
      analytics.onPlayerChange({ playing, time, duration });
      $('.watch-player')?.toggleAttribute('data-playing', !!playing);
      heat.onPlayerChange({ playing, time, duration });
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
  if (transcript) {
    const list = $('[data-transcript-lines]');
    let shown = -1;
    let langCode = transcript.lang;
    const qInput = $('[data-transcript-q]');
    const countEl = $('[data-transcript-count]');
    const draw = () => {
      const all = langCode === transcript.lang ? transcript.lines : transcript.translations[langCode] || transcript.lines;
      const q = qInput.value;
      const found = q.trim() ? searchLines(all, q, { limit: all.length }) : null;
      const rowsData = found ? found.map((m) => ({ line: all[m.index], ranges: m.ranges })) : all.map((line) => ({ line, ranges: null }));
      countEl.textContent = found ? (found.length ? `${found.length} ${found.length === 1 ? 'match' : 'matches'}` : 'No matches') : '';
      shown = -1; // rows are rebuilt, so the live current-line highlight is re-applied by mark()
      list.replaceChildren(...rowsData.map(({ line: l, ranges }) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'watch-transcript-line'; b.dataset.start = String(l.startMs); b.dataset.end = String(l.endMs);
        const t = document.createElement('span'); t.className = 'watch-transcript-time'; t.textContent = clock(l.startMs);
        const w = document.createElement('span');
        if (ranges) {
          for (const piece of highlightPieces(l.text, ranges)) {
            if (piece.hit) { const m = document.createElement('mark'); m.textContent = piece.text; w.appendChild(m); }
            else w.appendChild(document.createTextNode(piece.text));
          }
        } else w.textContent = l.text;
        b.append(t, w);
        b.addEventListener('click', () => { player.seek(l.startMs / 1000); player.play(); });
        li.appendChild(b);
        return li;
      }));
      mark();
    };
    $('[data-transcript-lang]')?.addEventListener('change', (e) => { langCode = e.target.value; draw(); });
    qInput.addEventListener('input', draw);
    qInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = list.querySelector('.watch-transcript-line');
      if (first && qInput.value.trim()) { player.seek(Number(first.dataset.start) / 1000); player.play(); }
    });
    const mark = () => {
      if (!list.isConnected) { clearInterval(follow); return; }
      const ms = player.time * 1000;
      const rows = [...list.querySelectorAll('.watch-transcript-line')];
      const i = rows.findIndex((r) => ms >= Number(r.dataset.start) && ms < Number(r.dataset.end));
      if (i === shown) return;
      rows[shown]?.removeAttribute('aria-current');
      if (i >= 0) rows[i].setAttribute('aria-current', 'true');
      shown = i;
    };
    const follow = setInterval(mark, 250);
    draw();
  }
  container.querySelectorAll('[data-chapter]').forEach((b) => b.addEventListener('click', () => { player.seek(chapters[Number(b.dataset.chapter)].startMs / 1000); player.play(); }));
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
    if (!a || !frame.contains(a) || a.dataset.hotspot) return; // hotspots report overlay_click themselves
    const clip = a.closest('[data-clip-id]')?.dataset.clipId || null;
    const label = labelFor(clip) || String(a.textContent || '').trim().slice(0, 60) || null;
    const isCall = /^tel:/i.test(a.getAttribute('href') || '');
    const props = { ...(label ? { label } : {}), ...(isPricingLabel(label) ? { pricing: true } : {}) };
    analytics.track(isCall ? 'call_click' : 'cta_click', { clip, t: player.time, props: Object.keys(props).length ? props : undefined });
  }, true);
  // The landing page's booking button (Video Outreach) counts as a CTA click.
  container.querySelector('[data-landing-cta]')?.addEventListener('click', () => {
    analytics.track('cta_click', { t: player.time, props: { label: String(ctaShown).slice(0, 60) } });
  });
  // Talk live with the sender while they are available (WebRTC; signalling over Supabase Realtime).
  const liveBtn = container.querySelector('[data-live-call]');
  if (liveBtn) startLiveCalls({ button: liveBtn, videoId: video.id, contactId: viewerProfile?.id || null, host: landing.live?.host || '', analytics, player, container }).catch(() => {});
  // Playback errors are measured too (the viewer sees the player's own message).
  frame.addEventListener('error', (e) => { if (e.target?.tagName === 'VIDEO' || e.target?.tagName === 'AUDIO') analytics.track('error', { props: { reason: 'media' } }); }, true);
  globalThis.addEventListener?.('pagehide', () => { heat.destroy(); analytics.destroy(); }, { once: true });

  early.release(player);
  return player;
}
