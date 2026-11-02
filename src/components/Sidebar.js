import { openMonetizationHub } from '../lib/monetizationIntegration.js';
import { getStudioIcon } from '../lib/studioRoutes.js';

export function Sidebar(navigate) {
  const element = document.createElement('aside');
  element.className = 'hidden md:flex flex-col items-center py-4 z-40 border-r border-white/5 bg-panel-bg overflow-y-auto custom-scrollbar';
  element.style.width = '68px';

  // Side menu, grouped by what the studio makes. Icons come from the shared
  // route table so the sidebar, the in-studio drawer and the top bar agree.
  // Training, Chat, Assist, Stock Media and Community were retired from the menu.
  const navGroups = [
    { title: '', items: [
      { id: 'apps', label: 'Apps' },
      { id: 'explore', label: 'Explore' },
      { id: 'templates', label: 'Templates' },
    ] },
    { title: 'Image', items: [
      { id: 'image', label: 'Image' },
      { id: 'edit', label: 'Edit' },
      { id: 'upscale', label: 'Upscale' },
      { id: 'character', label: 'Character' },
      { id: 'commercial', label: 'Product Shot' },
      { id: 'brand', label: 'Brand' },
    ] },
    { title: 'Video', items: [
      { id: 'video', label: 'Video' },
      { id: 'cinema', label: 'Cinema' },
      { id: 'cinema-template', label: 'Cinema Templates' },
      { id: 'storyboard', label: 'Storyboard' },
      { id: 'effects', label: 'Vibe Motion' },
      { id: 'ai-vfx', label: 'AI VFX' },
      { id: 'animate', label: 'Animate' },
      { id: 'lipsync', label: 'Lip Sync' },
      { id: 'videotools', label: 'Video Tools' },
      { id: 'avatar', label: 'Avatar' },
      { id: 'audio', label: 'Audio' },
    ] },
    { title: 'Agents', items: [
      { id: 'video-agent', label: 'Video Agent' },
      { id: 'director', label: 'Director' },
      { id: 'timeline', label: 'Timeline' },
      { id: 'workbench', label: 'Workbench' },
      { id: 'viral', label: 'Viral' },
      { id: 'personalizer', label: 'Personalizer' },
      { id: 'website-builder', label: 'Website' },
    ] },
    { title: 'My Work', items: [
      { id: 'library', label: 'Library' },
      { id: 'content-library', label: 'Content' },
    ] },
  ].map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, icon: getStudioIcon(it.id) })) }));

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

    if (item.id === 'image') {
      iconBtn.style.color = 'var(--color-primary)';
      iconBtn.classList.add('bg-primary/10');
      label.style.color = 'var(--color-primary)';
    }

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
    buttons[item.id] = { iconBtn, label };
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

  element.addEventListener('route-changed', (e) => {
    const page = e.detail.page;
    const mappedPage = page === 'cinegen' ? 'workbench' : page.startsWith('template/') ? 'apps' : (['brand-dna', 'campaign', 'campaign-page', 'asset-edit', 'photo-studio', 'brand-photo-studio'].includes(page) ? 'brand' : (page === 'video-agent-studio' ? 'video-agent' : page));

    Object.entries(buttons).forEach(([id, { iconBtn, label }]) => {
      if (id === mappedPage) {
        iconBtn.style.color = 'var(--color-primary)';
        iconBtn.classList.add('bg-primary/10');
        label.style.color = 'var(--color-primary)';
      } else {
        iconBtn.style.color = '';
        iconBtn.classList.remove('bg-primary/10');
        label.style.color = '';
      }
    });
  });

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
    element.style.paddingLeft = '52px';
    element.classList.add('fixed', 'inset-y-0', 'left-0', 'z-50');
    backdrop.classList.remove('hidden');
  };
  const closeSidebar = () => {
    if (!sidebarOpen) return;
    sidebarOpen = false;
    element.style.display = '';
    element.style.paddingLeft = '';
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
