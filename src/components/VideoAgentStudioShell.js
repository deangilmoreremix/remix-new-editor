// SmartVideo Video Agent Studio 2 — integration shell.
//
// This module is the *only* SmartVideo-side surface for the new
// `video-agent-studio` route. It embeds the complete OpenChatCut
// application running under `apps/video-agent-studio/` as an iframe.
//
// Design contract (Phase 4, post-clarification):
//
//  1. The shell does NOT integrate OpenChatCut with SmartVideo's
//     auth, project state, media store, generation adapter, credit
//     ledger, event bus, or any other SmartVideo backend system.
//  2. The shell does NOT mutate the upstream OpenChatCut source.
//     The studio is shipped as a `git subtree` at
//     `apps/video-agent-studio/`. Subtree updates
//     (see `npm run update:video-agent-studio-subtree`) must work
//     cleanly against this branch.
//  3. The shell does NOT pass any timeline, media, project,
//     generation, or export commands across the iframe boundary.
//  4. The shell only displays SmartVideo-branded chrome (header,
//     page title, loading splash, error splash, retry button) and
//     waits for an *optional* readiness handshake (`studio.ready`)
//     from the OpenChatCut application. If the handshake is not
//     used, the shell simply waits for the iframe to finish loading
//     and then reveals it.
//
// See docs/video-agent/ARCHITECTURE.md and
// docs/video-agent/OPENCHATCUT-MIGRATION.md for the full
// architecture.

import { mountStudioChrome } from '../lib/studioChrome.js';

// Dev port for OpenChatCut. The root SmartVideo dev server binds
// 3100; ai-vfx uses 3000; this uses 5199 to keep them distinct. In
// production, this is overridden by VITE_VIDEO_AGENT_STUDIO_URL.
const DEFAULT_DEV_URL = 'http://localhost:5199/';

// User-facing branding strings for the SmartVideo Video Agent Studio 2.
export const VIDEO_AGENT_STUDIO_BRAND = Object.freeze({
  productName: 'SmartVideo Video Agent Studio 2',
  shortName: 'Video Agent Studio 2',
  tagline: 'Edit complete videos with an AI agent',
  pageTitle: 'Video Agent Studio 2 — SmartVideo',
  headerSubtitle: 'AI-native editor · powered by OpenChatCut',
  splashLoadingText: 'Loading Video Agent Studio 2…',
  splashErrorTitle: 'Video Agent Studio 2 is not running',
  splashErrorBody:
    'Start the complete OpenChatCut application, then retry.',
  splashErrorCommand: 'npm run dev:video-agent-studio',
  retryLabel: 'Retry',
  backLabel: 'Back to SmartVideo',
});

function resolveStudioUrl() {
  const fromEnv =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VIDEO_AGENT_STUDIO_URL) ||
    (typeof window !== 'undefined' && window.__VIDEO_AGENT_STUDIO_URL__);
  const url = (fromEnv || DEFAULT_DEV_URL).toString();
  return url.endsWith('/') ? url : `${url}/`;
}

function isSameStudioOrigin(origin) {
  try {
    const studio = new URL(resolveStudioUrl());
    return origin === `${studio.protocol}//${studio.host}`;
  } catch (_) {
    return false;
  }
}

/**
 * Build the SmartVideo-branded chrome wrapper around the OpenChatCut
 * iframe.
 *
 * The chrome handles:
 *   - header (product name + tagline)
 *   - loading splash
 *   - error splash (with Retry button) if the iframe never loads
 *   - back navigation into SmartVideo
 *   - cleanup of the postMessage listener when the route closes
 *
 * The inner editor retains its own complete OpenChatCut UI; the
 * chrome does not attempt to replicate or alter the editor.
 */
export function VideoAgentStudioShell({ initialProjectId } = {}) {
  const container = document.createElement('div');
  container.className =
    'w-full h-full flex flex-col items-stretch justify-stretch bg-app-bg relative overflow-hidden';
  container.dataset.route = 'video-agent-studio';
  mountStudioChrome(container, { currentRoute: 'video-agent-studio' });

  // ---- Header (SmartVideo chrome) ----
  const header = document.createElement('div');
  header.className =
    'flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/5 bg-black/60 backdrop-blur';
  header.innerHTML = `
    <div class="flex items-center gap-3 min-w-0">
      <div class="w-10 h-10 shrink-0 rounded-xl bg-primary/20 flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" aria-hidden="true">
          <path d="M3 7l4 10 5-14 5 14 4-10"/>
        </svg>
      </div>
      <div class="min-w-0">
        <h1 class="text-lg md:text-xl font-black text-white truncate">${VIDEO_AGENT_STUDIO_BRAND.productName}</h1>
        <p class="text-xs text-secondary truncate">${VIDEO_AGENT_STUDIO_BRAND.headerSubtitle}</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button id="va-back" type="button" class="px-3 py-2 text-xs text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors">
        ${VIDEO_AGENT_STUDIO_BRAND.backLabel}
      </button>
    </div>
  `;
  container.appendChild(header);

  // ---- Iframe area ----
  const stage = document.createElement('div');
  stage.className = 'flex-1 min-h-0 relative';
  stage.style.cssText = 'position:relative;flex:1 1 auto;min-height:0;';

  const splash = document.createElement('div');
  splash.id = 'va-splash';
  splash.className =
    'absolute inset-0 flex items-center justify-center bg-app-bg';
  splash.innerHTML = `
    <div class="text-center max-w-md p-6">
      <div class="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      <p class="text-sm text-secondary">${VIDEO_AGENT_STUDIO_BRAND.splashLoadingText}</p>
    </div>
  `;
  stage.appendChild(splash);

  const iframe = document.createElement('iframe');
  iframe.id = 'va-iframe';
  iframe.title = VIDEO_AGENT_STUDIO_BRAND.productName;
  iframe.src = buildStudioUrl(initialProjectId);
  iframe.setAttribute('allow', 'clipboard-write fullscreen camera; microphone; autoplay');
  // The sandbox deliberately allows only what the OpenChatCut
  // application needs to run as its own application: scripts,
  // same-origin, forms, downloads, and popups that can escape the
  // sandbox. It does NOT allow top-level navigation; SmartVideo
  // navigation stays outside the iframe.
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads',
  );
  iframe.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;border:0;background:#0b0f19;opacity:0;transition:opacity .3s ease-in;';
  stage.appendChild(iframe);

  container.appendChild(stage);

  // ---- Error state (iframe never reaches a usable state) ----
  const errorSplash = document.createElement('div');
  errorSplash.id = 'va-error';
  errorSplash.className =
    'absolute inset-0 hidden flex-col items-center justify-center bg-app-bg text-center p-6';
  errorSplash.innerHTML = `
    <div class="max-w-lg w-full">
      <h2 class="text-xl font-black text-white mb-2">${VIDEO_AGENT_STUDIO_BRAND.splashErrorTitle}</h2>
      <p class="text-sm text-secondary mb-4">${VIDEO_AGENT_STUDIO_BRAND.splashErrorBody}</p>
      <code class="block text-xs bg-black/40 border border-white/10 rounded-md p-3 text-left text-white/70 mb-4">${VIDEO_AGENT_STUDIO_BRAND.splashErrorCommand}</code>
      <p class="text-xs text-white/40 mb-6 break-all">${escapeHtml(resolveStudioUrl())}</p>
      <div class="flex items-center justify-center gap-3">
        <button id="va-retry" type="button" class="px-4 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary/90">${VIDEO_AGENT_STUDIO_BRAND.retryLabel}</button>
      </div>
    </div>
  `;
  stage.appendChild(errorSplash);

  // ---- Minimal readiness handshake ----
  // The shell treats the iframe as "ready" when any of:
  //   - the iframe's load event fires
  //   - a `studio.ready` postMessage arrives from the studio
  //   - a `health.pong` postMessage arrives in response to a
  //     `health.ping`
  // The shell never reads or relays any project, media, generation
  // or export data. This is purely a "the iframe is alive" signal.
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    if (splash.parentNode) splash.parentNode.removeChild(splash);
    iframe.style.opacity = '1';
  };

  const onMessage = (event) => {
    if (!isSameStudioOrigin(event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'studio.ready') reveal();
    if (data.type === 'health.pong') reveal();
    if (data.type === 'studio.error') {
      // Best-effort: log to console; the existing error splash will
      // surface if the iframe never reaches a usable state.
      // eslint-disable-next-line no-console
      console.warn('[VideoAgentStudio2] studio reported error', data);
    }
  };
  window.addEventListener('message', onMessage);

  iframe.addEventListener('load', () => {
    // The OpenChatCut dev server can take a while to compile the
    // first time. Defer reveal a tick to allow postMessage readiness
    // messages to arrive first.
    setTimeout(reveal, 100);
  });

  // Optional: send a health.ping once. The studio can reply with
  // health.pong; we don't wait for the reply — the iframe load is
  // also a valid readiness signal.
  const healthPing = setTimeout(() => {
    try {
      iframe.contentWindow?.postMessage(
        { type: 'health.ping', source: 'smartvideo' },
        new URL(iframe.src).origin,
      );
    } catch (_) {
      /* ignore */
    }
  }, 1500);

  // If nothing has revealed the iframe after a generous window,
  // surface the error splash so the user is never stuck on the
  // spinner alone.
  const readyTimeout = window.setTimeout(() => {
    if (!revealed) {
      splash.classList.add('hidden');
      errorSplash.classList.remove('hidden');
      errorSplash.classList.add('flex');
    }
  }, 30_000);

  // ---- Back / Retry ----
  header.querySelector('#va-back')?.addEventListener('click', () => {
    window.history.length > 1 ? window.history.back() : (window.location.hash = '#/');
  });
  errorSplash.querySelector('#va-retry')?.addEventListener('click', () => {
    revealed = false;
    stage.insertBefore(splash, iframe);
    splash.classList.remove('hidden');
    errorSplash.classList.add('hidden');
    errorSplash.classList.remove('flex');
    iframe.style.opacity = '0';
    iframe.src = buildStudioUrl(initialProjectId);
    window.clearTimeout(readyTimeout);
    window.clearTimeout(healthPing);
  });

  // ---- Cleanup hook for the router ----
  container.cleanup = () => {
    window.clearTimeout(readyTimeout);
    window.clearTimeout(healthPing);
    window.removeEventListener('message', onMessage);
    try {
      iframe.src = 'about:blank';
    } catch (_) {}
  };

  return container;
}

function buildStudioUrl(initialProjectId) {
  const base = resolveStudioUrl();
  // OpenChatCut uses its own hash routing. We just pass a project
  // hint through the fragment so the studio can pre-select a
  // project if it wants to. The studio can ignore the fragment.
  const hash = initialProjectId
    ? `#/project/${encodeURIComponent(initialProjectId)}`
    : '#/';
  return base + hash.slice(1);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
