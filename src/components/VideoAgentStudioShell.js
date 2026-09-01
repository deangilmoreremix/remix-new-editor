// SmartVideo Video Agent Studio — integration shell.
//
// This module is the *SmartVideo-facing* entry point for the new
// `video-agent` route. It loads the OpenChatCut-derived Video Agent Studio
// running under `apps/video-agent-studio/` as a structurally isolated
// sub-application.
//
// Design contract:
//
// 1. The shell does NOT mutate the upstream OpenChatCut source.
//    The studio is shipped as a `git subtree` at `apps/video-agent-studio/`.
//    Subtree updates (see `npm run update:video-agent-studio-subtree`) must
//    work cleanly against this branch.
//
// 2. The shell DOES apply SmartVideo branding at the *chrome* level
//    (header, page title, splash, settings label). The internal app keeps
//    its OpenChatCut internals; user-facing text is overlaid by the shell
//    plus the SmartVideo-supplied <title>.
//
// 3. The shell is responsible for the SmartVideo auth bridge (Phase 7).
//    The authenticated SmartVideo user identity is posted to the iframe
//    via `postMessage` once the iframe is ready.
//
// 4. The Timeline Studio route (`timeline` -> `TimelineEditorPage.jsx`)
//    is NOT touched. Two independent editors, two independent state systems.
//
// 5. Generated media, project persistence, and credits all flow through
//    SmartVideo adapters (Phases 8-12). The shell's `window` exposes
//    those adapters to the iframe as `__SMARTVIDEO_BRIDGE__`.
//
// See docs/video-agent/ARCHITECTURE.md for the full architecture.

import { mountStudioChrome } from '../lib/studioChrome.js';
import { resolveSmartVideoAuthIdentity } from '../lib/videoAgentAuth.js';

// The dev port the Video Agent Studio's Vite dev server binds to. The root
// dev server is 3100; ai-vfx is 3000; this is 3200 to keep them distinct.
export const VIDEO_AGENT_STUDIO_DEV_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VIDEO_AGENT_STUDIO_URL) ||
  (typeof window !== 'undefined' && window.__VIDEO_AGENT_STUDIO_URL__) ||
  'http://localhost:3200/';

// Public-facing branding strings for the SmartVideo Video Agent Studio 2.
export const VIDEO_AGENT_STUDIO_BRAND = Object.freeze({
  productName: 'SmartVideo Video Agent Studio 2',
  shortName: 'Video Agent Studio 2',
  tagline: 'AI-native video editing with the OpenChatCut engine',
  pageTitle: 'Video Agent Studio 2 — SmartVideo',
  headerSubtitle: 'AI-native editor · powered by OpenChatCut',
  splashLoadingText: 'Loading Video Agent Studio 2…',
  splashErrorText:
    'Video Agent Studio 2 is not running. Start it with `npm run dev:video-agent-studio` and reload.',
});

// postMessage message types exchanged with the embedded Video Agent Studio.
export const BRIDGE_MESSAGE_TYPES = Object.freeze({
  // iframe -> shell: the embedded app has booted and is ready to receive
  // the auth identity. The shell responds with SMARTVIDEO_BRIDGE_HELLO.
  SMARTVIDEO_BRIDGE_READY: 'smartvideo/bridge/ready',
  // Shell -> iframe: deliver SmartVideo auth identity + adapter config.
  SMARTVIDEO_BRIDGE_HELLO: 'smartvideo/bridge/hello',
  // iframe -> shell: project save request (Phase 8).
  SMARTVIDEO_BRIDGE_PROJECT_SAVE: 'smartvideo/bridge/project/save',
  // iframe -> shell: project load request (Phase 8).
  SMARTVIDEO_BRIDGE_PROJECT_LOAD: 'smartvideo/bridge/project/load',
  // iframe -> shell: ask the user to approve a paid generation (Phase 12).
  SMARTVIDEO_BRIDGE_APPROVAL_REQUEST: 'smartvideo/bridge/approval/request',
  // shell -> iframe: user's approval decision.
  SMARTVIDEO_BRIDGE_APPROVAL_RESULT: 'smartvideo/bridge/approval/result',
});

export { resolveSmartVideoAuthIdentity };

/**
 * Build the SmartVideo-branded chrome wrapper around the Video Agent Studio
 * iframe. The chrome handles:
 *
 *   - header (product name + tagline)
 *   - loading splash
 *   - error splash if the dev server is not reachable
 *   - postMessage handshake with the iframe
 *   - back navigation into SmartVideo
 *
 * The inner editor retains its own full OpenChatCut UI; the chrome does not
 * attempt to replicate the editor.
 */
export function VideoAgentStudioShell({ initialProjectId } = {}) {
  const container = document.createElement('div');
  container.className =
    'w-full h-full flex flex-col items-stretch justify-stretch bg-app-bg relative overflow-hidden';
  container.dataset.route = 'video-agent';
  mountStudioChrome(container, { currentRoute: 'video-agent' });

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
        Back to SmartVideo
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
  iframe.setAttribute('allow', 'clipboard-write fullscreen camera; microphone');
  iframe.setAttribute(
    'sandbox',
    'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads',
  );
  iframe.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;border:0;background:#0b0f19;opacity:0;transition:opacity .3s ease-in;';
  stage.appendChild(iframe);

  container.appendChild(stage);

  // ---- Error state (iframe never reaches READY in time) ----
  let readyReceived = false;
  const errorSplash = document.createElement('div');
  errorSplash.id = 'va-error';
  errorSplash.className = 'absolute inset-0 hidden items-center justify-center bg-app-bg text-center p-6';
  errorSplash.innerHTML = `
    <div class="max-w-md">
      <h2 class="text-xl font-black text-white mb-2">${VIDEO_AGENT_STUDIO_BRAND.productName}</h2>
      <p class="text-sm text-secondary mb-4">${VIDEO_AGENT_STUDIO_BRAND.splashErrorText}</p>
      <code class="block text-xs bg-black/40 border border-white/10 rounded-md p-3 text-left text-white/70 mb-4">${VIDEO_AGENT_STUDIO_DEV_URL}</code>
      <button id="va-retry" type="button" class="px-4 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary/90">Retry</button>
    </div>
  `;
  stage.appendChild(errorSplash);

  // ---- Handshake ----
  const onMessage = (event) => {
    if (!isSameStudioOrigin(event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === BRIDGE_MESSAGE_TYPES.SMARTVIDEO_BRIDGE_READY) {
      readyReceived = true;
      splash.remove();
      iframe.style.opacity = '1';
      resolveSmartVideoAuthIdentity().then((identity) => {
        iframe.contentWindow?.postMessage(
          {
            type: BRIDGE_MESSAGE_TYPES.SMARTVIDEO_BRIDGE_HELLO,
            identity,
            projectId: initialProjectId || null,
            brand: VIDEO_AGENT_STUDIO_BRAND,
            bridgeVersion: 1,
          },
          event.origin,
        );
      });
    }
  };
  window.addEventListener('message', onMessage);

  const readyTimeout = window.setTimeout(() => {
    if (!readyReceived) {
      splash.classList.add('hidden');
      errorSplash.classList.remove('hidden');
      errorSplash.classList.add('flex');
    }
  }, 12_000);

  header.querySelector('#va-back')?.addEventListener('click', () => {
    window.history.length > 1 ? window.history.back() : (window.location.hash = '#/');
  });
  errorSplash.querySelector('#va-retry')?.addEventListener('click', () => {
    readyReceived = false;
    splash.classList.remove('hidden');
    errorSplash.classList.add('hidden');
    errorSplash.classList.remove('flex');
    iframe.src = buildStudioUrl(initialProjectId);
  });

  container.cleanup = () => {
    window.clearTimeout(readyTimeout);
    window.removeEventListener('message', onMessage);
    try {
      iframe.src = 'about:blank';
    } catch (_) {}
  };

  return container;
}

function buildStudioUrl(initialProjectId) {
  const base = VIDEO_AGENT_STUDIO_DEV_URL;
  const hash = initialProjectId
    ? `#/project/${encodeURIComponent(initialProjectId)}`
    : '#/';
  return base.endsWith('/') ? `${base}${hash}` : `${base}/${hash}`;
}

function isSameStudioOrigin(origin) {
  try {
    const studio = new URL(VIDEO_AGENT_STUDIO_DEV_URL);
    return origin === `${studio.protocol}//${studio.host}`;
  } catch (_) {
    return false;
  }
}
