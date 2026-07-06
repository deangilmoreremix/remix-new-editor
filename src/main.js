import './style.css';
import { Header } from './components/Header.js';
import { Sidebar } from './components/Sidebar.js';
import { initRouter, navigate } from './lib/router.js';
import { perfMonitor } from './lib/performance.js';
import { analytics } from './lib/analytics.js';
import { showToast } from './lib/loading.js';

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
    message.includes('Script error.') ||
    message.includes('TypeError: Cannot read') ||
    message.includes('undefined ') ||
    message.includes('null ') ||
    message.includes('NetworkError') ||
    message.includes('Failed to fetch') ||
    message.includes('Network request failed')
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
    const hashPage = hash.slice(2);
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

  // Full-page sign-in route — no header/sidebar shell
  if (initialPage === 'signin') {
    const { SignInPage } = await import('./components/landing/SignInPage.jsx');
    const signInPage = SignInPage();
    app.appendChild(signInPage);
    console.log('[App] Sign in page rendered');
    return;
  }

  const headerEl = Header((page) => navigate(page));
  app.appendChild(headerEl);

  const body = document.createElement('div');
  body.className = 'flex flex-1';

  const sidebar = Sidebar((page) => navigate(page));
  body.appendChild(sidebar);

  const contentArea = document.createElement('main');
  contentArea.id = 'content-area';
  contentArea.className = 'flex-1 relative w-full flex flex-col bg-app-bg';
  body.appendChild(contentArea);

  app.appendChild(body);

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
  navigate(initialPage);
  
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
      const { PersonalizationModal } = await import('../components/modals/PersonalizationModal.jsx');
      content.innerHTML = '';
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(content);
      activeTimelineModal.instance = { root };
      try {
        const mod = await import('react');
        root.render(mod.createElement(PersonalizationModal, {
          handleClose: () => { root.unmount?.(); activeTimelineModal.unmount?.(); },
          options: { elementType: props.elementType, onAdd: props.onAdd, tokenModes: props.tokenModes }
        }));
      } catch (err) {
        content.innerHTML = '<div style="padding:32px 24px;color:#fff;"><h2 style="margin:0 0 8px;">Personalizer</h2><p style="color:rgba(255,255,255,0.55);margin:0;">Open the timeline Personalizer inside the editor.</p></div>';
        console.warn('[TimelineModalBridge] React unavailable for Personalization modal', err);
      }
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

    if (modal === 'settings') {
      const { default: SettingsModal } = await import('./components/modals/SettingsModal.js');
      new SettingsModal().open();
      activeTimelineModal.unmount();
      return;
    }

    if (modal === 'project') {
      const { default: CreateProjectModal } = await import('./components/modals/CreateProjectModal.js');
      new CreateProjectModal().open();
      activeTimelineModal.unmount();
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
