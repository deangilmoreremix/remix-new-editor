import './style.css';
import './components/modals/modal-styles.css';

// Popcorn.JS — initialize as early as possible (ESM init replicating
// lib/PopcornProxy.js). initPopcorn() runs labeled dynamic imports so the
// real error surfaces in the dev-tools console if any step fails.
import { initPopcorn } from './lib/popcornInit.js';
initPopcorn().then(() => {
  console.log('[popcorn]', typeof window.Popcorn, Object.keys(window.Popcorn.registryByName || {}).length);
}).catch((e) => {
  console.error('[popcorn] init failed', e);
});

import { Header } from './components/Header.js';
import { Sidebar } from './components/Sidebar.js';
import { initRouter, navigate } from './lib/router.js';
import { perfMonitor } from './lib/performance.js';
import { analytics } from './lib/analytics.js';
import { showToast } from './lib/loading.js';
import { escapeHtml } from './lib/security.js';
import { isDevBypass, apiKeyManager } from './lib/apiKeyManager.js';
import { setupGlobalErrorHandlers } from './lib/errorBoundary.js';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

setupGlobalErrorHandlers();

console.log('[App] Starting initialization...');

// Track initialization performance
const initStart = performance.now();

// Global error handlers for uncaught exceptions
window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error);

  // Suppress common non-fatal and storage/worker/network noise globally
  const message = event.message || '';
  if (
    message.includes('ResizeObserver') ||
    message.includes('passive event listener') ||
    message.includes('non-passive') ||
    message.includes('QuotaExceededError') ||
    message.includes('NS_ERROR_DOM_QUOTA_REACHED') ||
    message.includes('SecurityError') ||
    message.includes('DOM Exception 18') ||
    message.includes('Failed to construct \'Worker\'') ||
    message.includes('Script at') ||
    message.includes('Load failed') ||
    message.includes('Script error.')
  ) {
    return;
  }

  analytics.trackError('uncaught_exception', message || 'Unknown error', {
    filename: event.filename,
    lineno: event.lineno
  });

  // Do not show a toast here. Fatal UI-breaking init errors are handled
  // by the fallback page below; everything else is logged/analytics only.
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);

  if (
    event.reason?.name === 'AbortError' ||
    event.reason?.message?.includes('cancelled') ||
    event.reason?.message?.includes('Request cancelled')
  ) {
    return;
  }

  analytics.trackError('unhandled_rejection', event.reason?.message || String(event.reason));
});

// Service worker registration for offline support (production)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('[SW] Registration failed:', err);
    });
  });
}

// Visibility change handler - pause/resume operations when tab is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden - pause non-essential operations
    console.log('[App] Page hidden, pausing operations');
  } else {
    // Page is visible again
    console.log('[App] Page visible, resuming operations');
  }
});

// Online/offline detection
window.addEventListener('online', () => {
  showToast('Connection restored', 'success', 3000);
});

window.addEventListener('offline', () => {
  showToast('You are offline. Some features may not work.', 'warning', 10000);
});

(async () => {
try {
  const app = document.querySelector('#app');
  if (!app) {
    throw new Error('App container not found');
  }

  app.innerHTML = '';

  // Compute initial page from URL (deep linking + studio query param)
  const path = window.location.pathname;
  const hash = window.location.hash;
  let initialPage = 'landing';

  if (path === '/' || path === '') {
    initialPage = 'landing';
  } else if (path.startsWith('/')) {
    initialPage = path.slice(1);
  }

  // Hash-based routing (e.g. /#/signin)
  if (hash && hash.startsWith('#/')) {
    const hashPage = hash.slice(2).replace(/^\//, '');
    if (hashPage) initialPage = hashPage;
  }

  // Handle studio query param
  const studioParam = new URLSearchParams(window.location.search).get('studio');
  if (studioParam) {
    initialPage = studioParam;
  }

  // Full-page landing route — no header/sidebar shell
  if (initialPage === 'landing') {
    const { default: LandingPage } = await import('./components/landing/LandingPage.jsx');
    const landingPage = await LandingPage();
    app.appendChild(landingPage);
    console.log('[App] Landing page rendered');
    return;
  }

  // Auth + account pages are owned by Clerk (Option A: replaces Supabase
  // sign-in). Custom app-styled pages handle sign-in, sign-up, forgot-password
  // and reset-password (built on Clerk's reset_password_email_code flow).
  // /account and /profile render Clerk-protected pages.
  const CLERK_PAGES = ['signin', 'signup', 'forgot-password', 'reset-password', 'account', 'profile'];
  if (CLERK_PAGES.includes(initialPage)) {
    if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
      app.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#020205;color:#fff;flex-direction:column;padding:20px;text-align:center;"><h1 style="color:#ff4444;margin-bottom:16px;">Clerk not configured</h1><p style="color:#aaa;">Set VITE_CLERK_PUBLISHABLE_KEY to enable authentication.</p></div>';
      return;
    }
    const { mountClerkRoute } = await import('./components/auth/ClerkAuth.jsx');
    const rootEl = document.createElement('div');
    app.appendChild(rootEl);
    mountClerkRoute(initialPage, rootEl);
    console.log('[App] Clerk page rendered: ' + initialPage);
    return;
  }

  const { header: headerEl, headerAuthSlot } = Header((page) => navigate(page));
  app.appendChild(headerEl);

  const body = document.createElement('div');
  body.className = 'flex flex-1';

  const { sidebar, toggleBtn } = Sidebar((page) => navigate(page));
  body.appendChild(sidebar);
  document.body.appendChild(toggleBtn);

  const contentArea = document.createElement('main');
  contentArea.id = 'content-area';
  contentArea.className = 'flex-1 relative w-full flex flex-col bg-app-bg';
  body.appendChild(contentArea);

  app.appendChild(body);

  const { mountHeaderAuth } = await import('./components/auth/HeaderAuth.jsx');
  mountHeaderAuth(headerAuthSlot);

  initRouter(contentArea, (page) => {
    headerEl.dispatchEvent(new CustomEvent('route-changed', { detail: { page } }));
    sidebar.dispatchEvent(new CustomEvent('route-changed', { detail: { page } }));
    if (typeof activeTimelineModal?.unmount === 'function') {
      activeTimelineModal.unmount();
    }
  });

  // Track initialization time
  const initDuration = performance.now() - initStart;
  perfMonitor.trackPageLoad('initialization', initDuration);
  
  console.log(`[App] Initialized in ${initDuration.toFixed(2)}ms`);
  
  console.log('[App] Navigating to initial page:', initialPage);
  // Preserve any deep-link query params (e.g. ?asset=<id> for Render) so the
  // target page can read them. navigate() serializes params into the URL.
  const initialParams = Object.fromEntries(new URLSearchParams(window.location.search).entries());
  navigate(initialPage, initialParams);

  // Show the provider API key setup popup once when the user lands in the app.
  // Gated per-session so it doesn't re-appear on every in-app navigation, and
  // skipped during local dev auth-bypass (a placeholder key is already seeded).
  if (isDevBypass) {
    console.info('[App] Dev auth bypass active — skipping setup popup.');
  } else {
    showSetupModalOnce();
  }

} catch (error) {
  console.error('[App] Fatal initialization error:', error);
  
  // Track fatal error
  analytics.trackError('fatal_init', error.message);
  
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff; flex-direction: column; padding: 20px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 20px;">😕</div>
      <h1 style="color: #ff4444; margin-bottom: 20px;">Application Error</h1>
      <p style="color: #aaa; max-width: 600px; margin-bottom: 20px;">${escapeHtml(error.message)}</p>
      <p style="color: #666; font-size: 12px; margin-bottom: 20px;">Please try refreshing the page. If the problem persists, clear your browser cache.</p>
      <button onclick="location.reload()" style="padding: 12px 24px; background: #3b82f6; border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: bold;">Reload Page</button>
    </div>
  `;
}
})();

/**
 * Show the provider API key setup popup exactly once per browser session.
 * Uses sessionStorage so reloading the tab won't re-trigger it, but a fresh
 * session will. Users can also reopen it anytime from the Settings action.
 *
 * Skips the popup entirely if the user already has API keys stored.
 */
function showSetupModalOnce() {
  const SESSION_FLAG = 'setup_popup_shown';
  try {
    // If keys are already configured, never show the setup popup again.
    if (apiKeyManager.hasAnyKey()) {
      console.info('[App] API keys already configured — skipping setup popup.');
      return;
    }
    if (sessionStorage.getItem(SESSION_FLAG)) return;
    sessionStorage.setItem(SESSION_FLAG, '1');
  } catch {
    // If storage is unavailable, fall back to showing it only once per load.
    if (window.__setupPopupShown) return;
    window.__setupPopupShown = true;
  }
  import('./components/SettingsModal.js').then(({ SettingsModal }) => {
    document.body.appendChild(SettingsModal());
  }).catch((err) => {
    console.warn('[App] Failed to open setup popup', err);
  });
}

window.addEventListener('navigate', (e) => {
  if (e.detail.page === 'settings') {
    import('./components/SettingsModal.js').then(({ SettingsModal }) => {
      document.body.appendChild(SettingsModal());
    });
  } else {
    navigate(e.detail.page);
  }
});

// Wrap navigate to add mobile menu cleanup - use a function wrapper instead of reassignment
const wrapNavigate = (navigateFn) => {
  return (page, params) => {
    // Remove any existing mobile menu before navigation
    const existingMobileMenu = document.querySelector('[data-mobile-menu]');
    if (existingMobileMenu) {
      existingMobileMenu.classList.add('opacity-0', 'pointer-events-none');
      setTimeout(() => existingMobileMenu.remove(), 300);
    }
    return navigateFn(page, params);
  };
};

const timelineModalRoot = document.createElement('div');
timelineModalRoot.id = 'timeline-modal-root';
timelineModalRoot.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;';
document.body.appendChild(timelineModalRoot);

const activeTimelineModal = {
  instance: null,
  container: null,
  unmount() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.instance = null;
  },
};

async function renderParentTimelineModal(modal, props = {}) {
  try {
    activeTimelineModal.unmount();
    const app = document.querySelector('#app');
    if (!app) return;
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:auto;';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);';
    const content = document.createElement('div');
    content.style.cssText = 'position:relative;z-index:1;max-width:520px;width:100%;max-height:88vh;overflow:auto;border-radius:24px;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(180deg,#0b0f1920,#0a0d16f0);box-shadow:0 20px 60px rgba(0,0,0,0.45);';
    overlay.addEventListener('click', () => activeTimelineModal.unmount());
    container.appendChild(overlay);
    container.appendChild(content);
    app.appendChild(container);
    activeTimelineModal.container = container;

    if (modal === 'personalization') {
      content.innerHTML = '<div style="padding:32px 24px;color:#fff;"><h2 style="margin:0 0 8px;">Personalizer</h2><p style="color:rgba(255,255,255,0.55);margin:0;">The Personalization modal is not available in this build.</p></div>';
      return;
    }

    if (modal === 'token-editor') {
      const { default: TokenEditor } = await import('../components/TokenEditor.jsx');
      content.innerHTML = '';
      const { createRoot } = await import('react-dom/client').catch(() => ({}));
      const root = createRoot?.(content);
      if (root) {
        activeTimelineModal.instance = { root };
        try {
          const mod = await import('react');
          root.render(mod.createElement(TokenEditor, {
            onTokensChange: (tokens) => console.log('[TokenEditor]', tokens),
            initialTokens: props.tokens || {}
          }));
        } catch (err) {
          content.innerHTML = '<div style="padding:32px 24px;color:#fff;"><h2 style="margin:0 0 8px;">Tokens</h2><p style="color:rgba(255,255,255,0.55);margin:0;">Token editor requires React runtime.</p></div>';
          console.warn('[TimelineModalBridge] React unavailable for TokenEditor modal', err);
        }
      } else {
        content.innerHTML = '<div style="padding:32px 24px;color:#fff;"><h2 style="margin:0 0 8px;">Tokens</h2><p style="color:rgba(255,255,255,0.55);margin:0;">Token editor will load once React is mounted.</p></div>';
      }
      return;
    }

    if (modal === 'batch-generator') {
      content.innerHTML = '<div style="padding:32px 24px;color:#fff;"><h2 style="margin:0 0 8px;">Batch Generator</h2><p style="color:rgba(255,255,255,0.55);margin:0;">Select a base video and import contacts before running batch generation.</p></div>';
      return;
    }

    if (modal === 'social-publisher') {
      content.innerHTML = '<div style="padding:32px 24px;color:#fff;"><h2 style="margin:0 0 8px;">Social Publisher</h2><p style="color:rgba(255,255,255,0.55);margin:0;">Connect a platform account to publish from the timeline.</p></div>';
      return;
    }

    content.innerHTML = `<div style="padding:32px 24px;color:#fff;"><h2 style="margin:0 0 8px;font-weight:700;">${String(modal)}</h2><p style="color:rgba(255,255,255,0.55);margin:0;">Modal coming online.</p></div>`;
  } catch (err) {
    console.error('[TimelineModalBridge] Failed to show modal', modal, err);
    activeTimelineModal.unmount();
  }
}

window.addEventListener('timeline:open-modal', (event) => {
  try {
    const { modal, props = {} } = event.detail || {};
    if (modal) {
      renderParentTimelineModal(modal, props);
    }
  } catch (err) {
    console.warn('[TimelineModalBridge] Failed to route modal request', err);
  }
});

// Note: The wrapper is applied inside initRouter in the router module
// Expose navigate globally for debugging
window.navigate = navigate;

// Mount the React modal SYSTEM (StoreProvider + ModalContainer). Open modals
// by ID via window.openModal(id) / modal.store — rendered through ModalContainer.
// Dynamically imported so the modal graph loads AFTER main.js body runs and can
// never abort core app init.
import('./mountModalSystem.jsx')
  .then(({ default: mountModalSystem }) => mountModalSystem())
  .catch((err) => console.error('[ModalSystem] mount failed', err));

// Dev-only: allow signing in from the console without the real login UI.
// Usage: await window.devLogin()
if (import.meta.env.DEV) {
  import('./lib/devAuth.js').then(({ devLogin }) => {
    window.devLogin = devLogin;

    // Auto sign-in on load when dev credentials are configured, so you skip
    // the other monorepo app's auth pages entirely. No-op if already signed in.
    if (import.meta.env.VITE_DEV_USER_EMAIL && import.meta.env.VITE_DEV_USER_PASSWORD) {
      devLogin().catch((err) => {
        console.warn('[Dev] auto sign-in skipped:', err.message);
      });
    }
  });
}
