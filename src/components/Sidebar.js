import { openMonetizationHub } from '../lib/monetizationIntegration.js';
import { getStudioIcon, NAV_GROUPS, getNavItemForRoute } from '../lib/studioRoutes.js';

export function Sidebar(navigate) {
  const element = document.createElement('aside');
  element.className = 'hidden md:flex flex-col items-center py-4 z-40 border-r border-white/5 bg-panel-bg overflow-y-auto custom-scrollbar';
  element.style.width = '68px';

  // The app's only studio menu. The list lives in src/lib/studioRoutes.js
  // (NAV_GROUPS) so there is one place to add, rename or retire a studio.
  const navGroups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, icon: getStudioIcon(it.id) })) }));

  const bottomItems = [
    { id: 'settings', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>', label: 'Settings' },
  ];

  const buttons = {};

  const createButton = (item) => {
    const container = document.createElement('div');
    container.className = 'flex flex-col items-center gap-0.5 mb-0.5 cursor-pointer group w-full px-2';

    const iconBtn = document.createElement('button');
    iconBtn.innerHTML = item.icon;
    iconBtn.className = 'w-9 h-9 rounded-xl flex items-center justify-center transition-all bg-transparent text-secondary group-hover:bg-white/5 group-hover:text-white';

    const label = document.createElement('span');
    label.textContent = item.label;
    label.className = 'text-[9px] leading-tight text-center font-bold uppercase tracking-wider text-secondary group-hover:text-white transition-colors';

    container.onclick = () => {
      if (item.id === 'settings') {
        const event = new CustomEvent('navigate', { detail: { page: 'settings' } });
        window.dispatchEvent(event);
        return;
      }
      if (item.id === 'monetize') {
        openMonetizationHub().catch(() => {});
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

  const navContainer = document.createElement('div');
  navContainer.className = 'flex flex-col flex-1 w-full items-center pt-2 gap-1';
  navGroups.forEach((group, gi) => {
    if (gi > 0) {
      const heading = document.createElement('div');
      heading.className = 'w-full mt-3 mb-1 pt-3 border-t border-white/5 text-center text-[8px] font-black uppercase tracking-[0.18em] text-white/30';
      heading.textContent = group.title;
      heading.dataset.sidebarGroup = group.title;
      navContainer.appendChild(heading);
    }
    group.items.forEach(item => navContainer.appendChild(createButton(item)));
  });
  element.appendChild(navContainer);

  const bottomContainer = document.createElement('div');
  bottomContainer.className = 'flex flex-col w-full items-center mt-auto';
  bottomItems.forEach(item => bottomContainer.appendChild(createButton(item)));
  element.appendChild(bottomContainer);

  const setActive = (page) => {
    const activeId = getNavItemForRoute(page);
    Object.entries(buttons).forEach(([id, { container, iconBtn, label }]) => {
      const active = id === activeId;
      iconBtn.style.color = active ? 'var(--color-primary)' : '';
      iconBtn.classList.toggle('bg-primary/10', active);
      label.style.color = active ? 'var(--color-primary)' : '';
      if (active) {
        container.setAttribute('aria-current', 'page');
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

  setActive(typeof window !== 'undefined' ? window.location.hash.slice(2) : '');
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
