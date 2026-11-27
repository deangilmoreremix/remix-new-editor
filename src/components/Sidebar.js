import { parseLocation } from '../lib/routeUrl.js';
import { getStudioIcon, NAV_GROUPS, getNavItemForRoute } from '../lib/studioRoutes.js';

const STORAGE_KEY = 'sv:sidebar';
const NARROW_WIDTH = '68px';
const WIDE_WIDTH = '232px';

const CHEVRON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';
const EXPAND_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>';
const COLLAPSE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>';

// Menu state (wide or narrow, and which groups are folded) is remembered per browser.
const loadState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { wide: !!saved.wide, collapsed: Array.isArray(saved.collapsed) ? saved.collapsed : [] };
  } catch (e) {
    return { wide: false, collapsed: [] };
  }
};
const saveState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ wide: state.wide, collapsed: state.collapsed }));
  } catch (e) { /* private mode or blocked storage: the menu still works, it just forgets */ }
};

export function Sidebar(navigate) {
  const element = document.createElement('aside');
  element.className = 'hidden md:flex flex-col items-center py-4 z-40 border-r border-white/5 bg-panel-bg overflow-y-auto overflow-x-hidden custom-scrollbar';

  const state = loadState();
  const collapsed = new Set(state.collapsed);
  const persist = () => { state.collapsed = [...collapsed]; saveState(state); };

  // The app's only studio menu. The list lives in src/lib/studioRoutes.js
  // (NAV_GROUPS) so there is one place to add, rename or retire a studio.
  const navGroups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, icon: getStudioIcon(it.id) })) }));

  const bottomItems = [
    { id: 'settings', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>', label: 'Settings' },
  ];

  const buttons = {};
  const groupEls = []; // { title, heading, chevron, body }

  const createButton = (item) => {
    const container = document.createElement('div');
    container.className = 'flex cursor-pointer group w-full px-2';

    const iconBtn = document.createElement('button');
    iconBtn.innerHTML = item.icon;
    iconBtn.className = 'shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-transparent text-secondary group-hover:bg-white/5 group-hover:text-white';

    const label = document.createElement('span');
    label.textContent = item.label;
    label.dataset.sidebarLabel = '';

    container.onclick = () => {
      if (item.id === 'settings') {
        const event = new CustomEvent('navigate', { detail: { page: 'settings' } });
        window.dispatchEvent(event);
        return;
      }
      navigate(item.id);
    };

    container.appendChild(iconBtn);
    container.appendChild(label);
    container.dataset.sidebarItem = item.id;
    buttons[item.id] = { container, iconBtn, label };
    return container;
  };

  // Narrow: icon over a short wrapped label. Wide: icon and full name side by side.
  const styleItems = () => {
    Object.values(buttons).forEach(({ container, label }) => {
      if (state.wide) {
        container.className = 'flex flex-row items-center gap-3 mb-0.5 cursor-pointer group w-full px-2';
        label.className = 'text-xs font-semibold text-secondary group-hover:text-white transition-colors truncate';
      } else {
        container.className = 'flex flex-col items-center gap-0.5 mb-0.5 cursor-pointer group w-full px-1';
        label.className = 'w-full text-[8px] leading-tight text-center font-bold uppercase tracking-normal break-words text-secondary group-hover:text-white transition-colors';
      }
    });
  };

  const navContainer = document.createElement('div');
  navContainer.className = 'flex flex-col flex-1 w-full items-center pt-2 gap-1';

  // Expand / collapse the whole menu.
  const widthToggle = document.createElement('button');
  widthToggle.type = 'button';
  widthToggle.dataset.sidebarToggle = '';
  widthToggle.className = 'hidden md:flex items-center justify-center gap-2 w-[calc(100%-16px)] mx-2 mb-2 h-8 rounded-lg text-secondary hover:text-white hover:bg-white/5 transition-colors text-[10px] font-bold uppercase tracking-wider';
  navContainer.appendChild(widthToggle);

  navGroups.forEach((group, gi) => {
    const body = document.createElement('div');
    body.className = 'w-full flex flex-col items-center';
    body.dataset.sidebarGroupBody = group.title;

    if (gi > 0) {
      const heading = document.createElement('button');
      heading.type = 'button';
      heading.dataset.sidebarGroup = group.title;
      heading.className = 'w-full mt-3 mb-1 pt-3 border-t border-white/5 flex items-center justify-center gap-1 text-[8px] font-black uppercase tracking-[0.14em] text-white/30 hover:text-white/70 transition-colors';
      const title = document.createElement('span');
      title.textContent = group.title;
      title.className = 'truncate';
      const chevron = document.createElement('span');
      chevron.innerHTML = CHEVRON;
      chevron.className = 'shrink-0 transition-transform';
      heading.appendChild(title);
      heading.appendChild(chevron);
      heading.onclick = () => {
        if (collapsed.has(group.title)) collapsed.delete(group.title); else collapsed.add(group.title);
        persist();
        applyCollapsed();
      };
      navContainer.appendChild(heading);
      groupEls.push({ title: group.title, heading, chevron, body });
    }
    group.items.forEach((item) => body.appendChild(createButton(item)));
    navContainer.appendChild(body);
  });
  element.appendChild(navContainer);

  const bottomContainer = document.createElement('div');
  bottomContainer.className = 'flex flex-col w-full items-center mt-auto';
  bottomItems.forEach((item) => bottomContainer.appendChild(createButton(item)));
  element.appendChild(bottomContainer);

  function applyCollapsed() {
    groupEls.forEach(({ title, heading, chevron, body }) => {
      const closed = collapsed.has(title);
      body.style.display = closed ? 'none' : '';
      heading.setAttribute('aria-expanded', closed ? 'false' : 'true');
      chevron.style.transform = closed ? 'rotate(-90deg)' : '';
    });
  }

  function applyWidth() {
    element.style.width = state.wide ? WIDE_WIDTH : NARROW_WIDTH;
    widthToggle.innerHTML = state.wide ? `${COLLAPSE_ICON}<span>Collapse</span>` : EXPAND_ICON;
    widthToggle.setAttribute('aria-expanded', state.wide ? 'true' : 'false');
    widthToggle.setAttribute('aria-label', state.wide ? 'Collapse menu' : 'Expand menu');
    widthToggle.title = state.wide ? 'Collapse menu' : 'Expand menu';
    styleItems();
  }

  widthToggle.onclick = () => {
    state.wide = !state.wide;
    persist();
    applyWidth();
  };

  applyWidth();
  applyCollapsed();

  const setActive = (page) => {
    const activeId = getNavItemForRoute(page);
    Object.entries(buttons).forEach(([id, { container, iconBtn, label }]) => {
      const active = id === activeId;
      iconBtn.style.color = active ? 'var(--color-primary)' : '';
      iconBtn.classList.toggle('bg-primary/10', active);
      label.style.color = active ? 'var(--color-primary)' : '';
      if (active) {
        container.setAttribute('aria-current', 'page');
        // The group holding the current studio is always open.
        const owner = groupEls.find((g) => g.body.contains(container));
        if (owner && collapsed.has(owner.title)) {
          collapsed.delete(owner.title);
          persist();
          applyCollapsed();
        }
        // Keep the current studio visible in the scrolling menu without
        // scrolling the page itself.
        requestAnimationFrame(() => {
          const box = element.getBoundingClientRect();
          const item = container.getBoundingClientRect();
          const top = item.top - box.top + element.scrollTop;
          const bottom = top + item.height;
          if (top < element.scrollTop) element.scrollTop = Math.max(0, top - 8);
          else if (bottom > element.scrollTop + element.clientHeight) element.scrollTop = bottom - element.clientHeight + 8;
        });
      } else {
        container.removeAttribute('aria-current');
      }
    });
  };

  setActive(typeof window !== 'undefined' ? parseLocation().page : '');
  element.addEventListener('route-changed', (e) => setActive(e.detail.page));

  // Mobile menu toggle button. On desktop the sidebar is always visible (via
  // the `hidden md:flex` class), so this button is `md:hidden` and only
  // matters on small screens, where it slides the sidebar in as a fixed
  // overlay. main.js mounts it on <body>.
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.setAttribute('aria-label', 'Toggle navigation menu');
  toggleBtn.className = 'md:hidden fixed top-3 left-3 z-[60] w-10 h-10 rounded-xl bg-panel-bg border border-white/10 text-white flex items-center justify-center';
  toggleBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';

  const backdrop = document.createElement('div');
  backdrop.className = 'md:hidden fixed inset-0 z-40 bg-black/60 hidden';

  let sidebarOpen = false;
  const openSidebar = () => {
    sidebarOpen = true;
    element.style.display = 'flex';
    // Start the list below the fixed hamburger instead of beside it.
    element.style.paddingTop = '64px';
    element.classList.add('fixed', 'inset-y-0', 'left-0', 'z-50');
    backdrop.classList.remove('hidden');
  };
  const closeSidebar = () => {
    if (!sidebarOpen) return;
    sidebarOpen = false;
    element.style.display = '';
    element.style.paddingTop = '';
    element.classList.remove('fixed', 'inset-y-0', 'left-0', 'z-50');
    backdrop.classList.add('hidden');
  };

  toggleBtn.addEventListener('click', () => {
    sidebarOpen ? closeSidebar() : openSidebar();
  });
  backdrop.addEventListener('click', closeSidebar);
  element.addEventListener('route-changed', closeSidebar);
  window.addEventListener('navigate', closeSidebar);

  document.body.appendChild(backdrop);

  return { sidebar: element, toggleBtn };
}
