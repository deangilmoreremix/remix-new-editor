import { mountStudioChrome } from '../lib/studioChrome.js';
// AI-VFX Studio Page
// Mounts the real apps/ai-vfx React app (src/App.jsx) into a container div
// using the same react-dom/client + dynamic react import bridge pattern that
// src/main.js uses for PersonalizationModal and TokenEditor.

export function AIVFXPage() {
  const container = document.createElement('div');
  container.className = 'w-full h-full flex flex-col overflow-hidden bg-app-bg';
  mountStudioChrome(container, { currentRoute: 'ai-vfx' });

  // Header bar matching the shell's visual language
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between p-4 border-b border-white/5 bg-black/50';
  header.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M12 2l2.39 6.95H22l-6.19 4.5L18.18 22 12 17.5 5.82 22l2.37-8.55L2 8.95h7.61L12 2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div>
        <h1 class="text-xl font-black text-white">AI VFX STUDIO</h1>
        <p class="text-xs text-secondary">Visual effects & motion generation • Powered by MuAPI</p>
      </div>
    </div>
  `;
  container.appendChild(header);

  // Mount surface for the real React app
  const mount = document.createElement('div');
  mount.id = 'ai-vfx-mount';
  mount.style.cssText = 'flex:1;min-height:0;overflow:auto;background:#0b0f19;';
  mount.innerHTML = `
    <div style="padding:24px;color:rgba(255,255,255,0.55);font-size:13px;">
      Loading AI VFX Studio…
    </div>
  `;
  container.appendChild(mount);

  // Kick off async React mount (mirrors the main.js bridge pattern)
  mountAIVFXApp(mount);

  return container;
}

async function mountAIVFXApp(mount, attempt = 0) {
  // Guard against double-mount: if a previous attempt already succeeded, skip.
  if (mount.dataset.mounted === 'true') return;

  let root = null;
  try {
    const { createRoot } = await import('react-dom/client');
    root = createRoot(mount);
  } catch (err) {
    // A network abort here usually means Vite invalidated the dep URLs because
    // it kicked off a re-optimize (it just discovered a new dependency). Retry
    // once the optimizer settles instead of leaving a permanent "Loading…".
    if (attempt < 3 && isViteRerun(err)) {
      scheduleRetry(mount, attempt + 1);
      return;
    }
    mount.innerHTML = renderFallback('React runtime unavailable', String(err?.message || err));
    console.warn('[AIVFXPage] react-dom/client unavailable', err);
    return;
  }

  try {
    const React = await import('react');
    const AppMod = await import('../../apps/ai-vfx/src/App.jsx');
    const App = AppMod.default;
    if (!App) {
      throw new Error('apps/ai-vfx/src/App.jsx did not export a default component');
    }
    root.render(React.createElement(App));
    mount.dataset.mounted = 'true';
  } catch (err) {
    // If Vite re-optimized mid-import, the dynamic import is aborted and the
    // dep URLs are stale. Retry after the optimizer finishes so the studio
    // actually loads rather than getting stuck.
    if (attempt < 3 && isViteRerun(err)) {
      try { root?.unmount(); } catch (_) { /* noop */ }
      scheduleRetry(mount, attempt + 1);
      return;
    }
    mount.innerHTML = renderFallback('Failed to mount AI VFX Studio', String(err?.message || err));
    console.error('[AIVFXPage] Failed to render ai-vfx App', err);
    try { root.unmount(); } catch (_) { /* noop */ }
  }
}

// Vite aborts in-flight module requests (ERR_ABORTED / "new dependencies
// optimized, reloading") when it discovers a new dependency during a dev
// session and re-runs the optimizer. Detect that specific situation so we can
// retry the mount once the optimized deps are served.
function isViteRerun(err) {
  const msg = String(err?.message || err || '');
  return (
    /ERR_ABORTED/i.test(msg) ||
    /new dependencies optimized/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg)
  );
}

function scheduleRetry(mount, attempt) {
  // Show a soft "reconnecting" state so the UI doesn't look frozen.
  mount.innerHTML = `
    <div style="padding:24px;color:rgba(255,255,255,0.55);font-size:13px;">
      Loading AI VFX Studio… (preparing dependencies, attempt ${attempt + 1})
    </div>
  `;
  // Vite signals completion by reloading the importing module; a short delay
  // lets the optimizer finish and the new dep URLs become available.
  setTimeout(() => mountAIVFXApp(mount, attempt), 600 * attempt);
}

function renderFallback(title, detail) {
  return `
    <div style="padding:32px 24px;color:#fff;font-family:system-ui,-apple-system,sans-serif;">
      <h2 style="margin:0 0 8px;font-size:18px;">${escape(title)}</h2>
      <p style="color:rgba(255,255,255,0.55);margin:0 0 8px;">
        The AI VFX Studio could not be loaded.
      </p>
      <pre style="white-space:pre-wrap;color:rgba(248,113,113,0.9);font-size:12px;margin:0;">${escape(detail || 'Unknown error')}</pre>
    </div>
  `;
}

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
