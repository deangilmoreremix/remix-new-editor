// studioChrome.js
// Shared, framework-agnostic helpers for in-studio navigation chrome:
//   - createStudioBackButton(onBack)  -> [data-studio-back]
//   - createStudioMenuButton(onToggle) -> [data-studio-menu]
//   - mountStudioDrawer(root, opts)   -> overlay listing ALL routes ([data-studio-drawer])
//
// Used by the vanilla *Studio.js components and the *Page studio routes.
import { navigate } from './router.js';
import { getGroupedStudioRoutes, getStudioIcon, getStudioLabel } from './studioRoutes.js';

const BACK_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
const MENU_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';

const BTN_CLASS = 'studio-nav-btn p-2 hover:bg-white/10 rounded-lg transition-colors shrink-0 text-white/70 hover:text-white';

export function createStudioBackButton(onBack) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `${BTN_CLASS} studio-back-btn`;
  btn.setAttribute('data-studio-back', '');
  btn.setAttribute('aria-label', 'Back');
  btn.innerHTML = BACK_SVG;
  btn.onclick = onBack || (() => navigate('apps'));
  return btn;
}

export function createStudioMenuButton(onToggle) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `${BTN_CLASS} studio-menu-btn`;
  btn.setAttribute('data-studio-menu', '');
  btn.setAttribute('aria-label', 'All studios');
  btn.innerHTML = MENU_SVG;
  btn.onclick = onToggle;
  return btn;
}

// Builds a top-left cluster: [menu][back]. Pass onBack/onMenu or defaults.
export function createStudioNavCluster({ onBack, onMenu, drawer } = {}) {
  const cluster = document.createElement('div');
  cluster.className = 'flex items-center gap-1 shrink-0';
  const toggle = onMenu || (drawer && drawer.toggle) || (() => {});
  cluster.appendChild(createStudioMenuButton(toggle));
  cluster.appendChild(createStudioBackButton(onBack));
  return cluster;
}

// Convenience: attach a consistent [menu][back] + title top bar and a drawer to a
// studio root container. Works for every studio surface (vanilla DOM factories,
// *Page routes, VideoAgent agents). The drawer is mounted on document.body so it is
// never clipped by studio overflow containers.
// Returns { topbar, drawer }.
export function mountStudioChrome(rootContainer, { title, onBack, currentRoute } = {}) {
  const drawer = mountStudioDrawer(document.body, { currentRoute });

  const topbar = document.createElement('div');
  topbar.className = 'studio-topbar';
  topbar.appendChild(createStudioMenuButton(drawer.toggle));
  topbar.appendChild(createStudioBackButton(onBack));

  if (title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'studio-topbar__title';
    titleEl.textContent = title;
    topbar.appendChild(titleEl);
  }

  const spacer = document.createElement('div');
  spacer.className = 'studio-topbar__spacer';
  topbar.appendChild(spacer);

  rootContainer.classList.add('studio-has-chrome');
  rootContainer.insertBefore(topbar, rootContainer.firstChild);

  return { topbar, drawer };
}

// Mounts a slide-in drawer (overlay) listing ALL routes, grouped by category.
// Returns { toggle, open, close, element }.
export function mountStudioDrawer(rootEl, { onNavigate, currentRoute } = {}) {
  const drawer = document.createElement('div');
  drawer.className = 'studio-drawer fixed inset-0 z-[60] hidden';
  drawer.setAttribute('data-studio-drawer', '');
  drawer.innerHTML = `
    <div class="studio-drawer__backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
    <aside class="studio-drawer__panel absolute left-0 top-0 h-full w-[300px] max-w-[85vw] bg-app-bg border-r border-white/10 overflow-y-auto custom-scrollbar p-4 shadow-2xl flex flex-col">
      <div class="flex items-center justify-between mb-4 shrink-0">
        <h2 class="text-sm font-bold uppercase tracking-wider text-white/60">All Studios</h2>
        <button type="button" class="studio-drawer__close p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="studio-drawer__groups flex-1 flex flex-col gap-5"></div>
    </aside>
  `;

  const groupsEl = drawer.querySelector('.studio-drawer__groups');
  const groups = getGroupedStudioRoutes();
  groups.forEach(({ category, items }) => {
    if (!items.length) return;
    const section = document.createElement('div');
    section.className = 'studio-drawer__group';
    const heading = document.createElement('div');
    heading.className = 'text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2 px-1';
    heading.textContent = category;
    section.appendChild(heading);
    const list = document.createElement('div');
    list.className = 'flex flex-col gap-0.5';
    items.forEach((item) => {
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'studio-drawer__item flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors text-left';
      link.setAttribute('data-route', item.route);
      if (item.route === currentRoute) link.classList.add('is-active');
      link.innerHTML = `<span class="shrink-0 w-5 h-5 flex items-center justify-center text-current">${item.icon}</span><span class="truncate">${item.label}</span>`;
      link.onclick = () => {
        const go = onNavigate || navigate;
        go(item.route);
        api.close();
      };
      list.appendChild(link);
    });
    section.appendChild(list);
    groupsEl.appendChild(section);
  });

  const api = {
    element: drawer,
    isOpen() { return !drawer.classList.contains('hidden'); },
    open() {
      drawer.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey);
    },
    close() {
      drawer.classList.add('hidden');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    },
    toggle() { api.isOpen() ? api.close() : api.open(); },
  };

  function onKey(e) { if (e.key === 'Escape') api.close(); }

  drawer.querySelector('.studio-drawer__backdrop').onclick = api.close;
  drawer.querySelector('.studio-drawer__close').onclick = api.close;

  rootEl.appendChild(drawer);
  return api;
}

export { getStudioIcon, getStudioLabel };
