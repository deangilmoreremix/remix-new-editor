// src/components/MuapiStudioPage.js
//
// Studio (route: #/muapi-studio): a muapi.ai/studio-style studio (Image, Video, Audio, Avatar, 3D, Tools,
// Text, More) that generates with any model in the MuAPI catalog.
//
// The studio itself is the vendored React component in vendor/muapi-studio. This page only hosts it:
//   - theme "lime" + the left icon rail, matching the rest of the app;
//   - the signed-in user's own MuAPI key (apiKeyManager), never a shared one;
//   - every network call goes through the app's Supabase muapi-proxy (see src/lib/muapiStudioTransport.js);
//   - with no key set, the studio shows "Connect your MuAPI key" and the button opens Settings.

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
      const render = () => {
        if (disposed || !root) return;
        root.render(createElement(MuapiStudio, {
          // Remount after Settings closes so a replaced key rebuilds the client and reloads models.
          key: keyVersion,
          apiBase: STUDIO_BASE,
          fetchImpl: studioFetch,
          connected: apiKeyManager.hasMuapiKey(),
          // Per-account storage: another key never shows this account's saved generations.
          accountId: scopeOfKey(apiKeyManager.getMuapiKey()),
          // Re-render after Settings closes so a newly saved key takes effect without a reload.
          onRequestApiKey: () => {
            if (settingsOpen) return;
            settingsOpen = true;
            // The key listener below remounts when the key actually changes, so closing the dialog needs no remount.
            settingsEl = SettingsModal(() => { settingsOpen = false; settingsEl = null; });
            document.body.appendChild(settingsEl);
          },
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
    settingsEl?.remove();
    settingsEl = null;
    try { root?.unmount(); } catch { /* already unmounted */ }
    root = null;
  };

  return container;
}
