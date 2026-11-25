// src/components/MuapiStudioPage.js
//
// Studio (route: #/muapi-studio): a muapi.ai/studio-style studio (Image, Video, Audio, Avatar, 3D, Tools,
// Text, More) that generates with any model in the MuAPI catalog.
//
// The studio itself is the vendored React component in vendor/muapi-studio. This page only hosts it:
//   - theme "lime" + the left icon rail, matching the rest of the app;
//   - the signed-in user's own MuAPI key (apiKeyManager), never a shared one;
//   - every network call goes through the app's Supabase muapi-proxy (see src/lib/muapiStudioTransport.js);
//   - with no key set there is no separate key screen: the page opens the app's shared API-key window
//     (the same one shown at sign-up) and the studio mounts by itself once a MuAPI key is saved there.

import { apiKeyManager } from '../lib/apiKeyManager.js';
import { muapi } from '../lib/muapi.js';
import { createMuapiStudioFetch, STUDIO_BASE } from '../lib/muapiStudioTransport.js';
import { SettingsModal } from './SettingsModal.js';

export function MuapiStudioPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full overflow-hidden bg-app-bg text-white';
  container.dataset.studio = 'muapi-studio';

  const host = document.createElement('div');
  host.className = 'w-full h-full';
  container.appendChild(host);

  const studioFetch = createMuapiStudioFetch({
    proxyUrl: muapi.proxyUrl,
    getKey: () => apiKeyManager.getMuapiKey(),
  });

  let root = null;
  let disposed = false;
  let settingsOpen = false; // don't stack a second Settings modal on top of ours
  let settingsEl = null;
  let stopKeyWatch = null;
  let keysObserver = null; // watches an API-key window this page did not open

  (async () => {
    try {
      const [{ createElement }, { createRoot }, { MuapiStudio, scopeOfKey }] = await Promise.all([
        import('react'),
        import('react-dom/client'),
        import('muapi-studio'),
      ]);
      // Styles are cosmetic: a failed CSS fetch must not stop the Studio from mounting.
      await import('muapi-studio/style.css').catch((e) => console.warn('[muapi-studio] stylesheet failed to load', e));
      if (disposed) return;

      root = createRoot(host);
      let keyVersion = 0;
      // One shared API-key window: reuse one that is already open (e.g. the sign-up popup) instead of stacking another.
      const openKeys = () => {
        if (settingsOpen || disposed) return;
        const existing = document.querySelector('[data-api-keys-modal]');
        settingsOpen = true;
        const onClosed = () => { settingsOpen = false; settingsEl = null; render(); };
        if (existing) {
          keysObserver = new MutationObserver(() => {
            if (existing.isConnected) return;
            keysObserver.disconnect(); keysObserver = null; onClosed();
          });
          keysObserver.observe(document.body, { childList: true });
          if (!apiKeyManager.hasMuapiKey()) render();
          return;
        }
        settingsEl = SettingsModal(onClosed);
        document.body.appendChild(settingsEl);
        if (!apiKeyManager.hasMuapiKey()) render();   // swap the re-open link for the quiet line behind the window
      };
      let autoOpened = false;
      const render = () => {
        if (disposed || !root) return;
        if (!apiKeyManager.hasMuapiKey()) {
          // No key yet: never mount the studio's own "Connect your MuAPI key" card. Open the shared window once,
          // and while it is open show only a quiet line; after it is closed, a single link reopens it.
          if (!autoOpened) { autoOpened = true; openKeys(); }
          const wrap = 'w-full h-full flex flex-col items-center justify-center gap-3 p-8 text-center text-sm text-secondary';
          root.render(settingsOpen
            ? createElement('div', { className: wrap }, 'Loading studio…')
            : createElement('div', { className: wrap },
              createElement('p', null, 'MuAPI Studio uses the MuAPI key from your API keys.'),
              createElement('button', {
                type: 'button',
                onClick: openKeys,
                // App buttons are outline-only (outline-buttons.css): lime border + lime text.
                style: { border: '1px solid #d9ff00', borderRadius: 8, background: 'transparent', color: '#d9ff00', padding: '9px 16px', fontWeight: 600, cursor: 'pointer' },
              }, 'Open API keys')));
          return;
        }
        root.render(createElement(MuapiStudio, {
          // Remount after Settings closes so a replaced key rebuilds the client and reloads models.
          key: keyVersion,
          apiBase: STUDIO_BASE,
          fetchImpl: studioFetch,
          connected: true, // only mounted with a key (see above)
          // Per-account storage: another key never shows this account's saved generations.
          accountId: scopeOfKey(apiKeyManager.getMuapiKey()),
          // Re-render after Settings closes so a newly saved key takes effect without a reload.
          // The key listener below remounts when the key actually changes.
          onRequestApiKey: openKeys,
          theme: 'lime',
          layout: 'rail',
          showHeader: false,
        }));
      };
      render();
      // Any key change (this page's dialog, or the app-wide Settings) remounts the Studio so the client,
      // models and per-account history all follow the new key.
      let renderedScope = scopeOfKey(apiKeyManager.getMuapiKey());
      stopKeyWatch = apiKeyManager.addListener(() => {
        const now = scopeOfKey(apiKeyManager.getMuapiKey());
        if (now === renderedScope) return;
        renderedScope = now;
        keyVersion += 1;
        render();
      });
    } catch (err) {
      console.error('[muapi-studio] failed to load', err);
      host.innerHTML = '<div class="w-full h-full flex items-center justify-center text-sm text-red-400">Could not load SmartVid Studio. Please reload the page.</div>';
    }
  })();

  // The router calls cleanup() when navigating away.
  container.cleanup = () => {
    disposed = true;
    stopKeyWatch?.();
    stopKeyWatch = null;
    keysObserver?.disconnect();
    keysObserver = null;
    settingsEl?.remove();
    settingsEl = null;
    try { root?.unmount(); } catch { /* already unmounted */ }
    root = null;
  };

  return container;
}
