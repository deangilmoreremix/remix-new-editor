// Landing Page Header - Cinematic Command Center style
//
// IMPORTANT: This is a hash-routed SPA (see src/lib/router.js). All menu links
// MUST use the in-app `navigate()` function and NOT raw `<a href="/route">`.
// A real `/image` href would trigger a full HTTP request to the server,
// which has no file or SPA-fallback redirect for those paths, producing a 404
// on production (e.g. https://smartvid.app/image → 404).
//
// Each link below uses `href="#/<route>"` so it is valid and bookmarkable
// (mirrors what the router writes into the URL bar via pushState) and a
// click handler that calls `e.preventDefault()` + `navigate(route)` to keep
// navigation in-app.
import { navigate } from "../../../lib/router.js";

// The standalone landing route never calls initRouter() (src/main.js returns
// early before the app shell is built), so the in-app navigate() is a no-op
// there. Detect a live router by the app shell's content area, and fall back
// to a full page load so main.js can boot the shell and route — the same
// approach used by goToRoute() in sections/minimax/ui.js.
function routerIsMounted() {
  return typeof document !== 'undefined' && !!document.getElementById('content-area');
}

function navigateOrReload(route, params = {}) {
  if (routerIsMounted()) {
    navigate(route, params);
    return;
  }
  const query = new URLSearchParams(params).toString();
  const target = query ? `/?${query}#/${route}` : `/#/${route}`;

  // On the standalone landing page the in-app router is not mounted, so
  // we fall back to a full page load so main.js can boot the app shell
  // and route. Hash-only navigations can be treated as same-document
  // by the browser and will not reload the page, leaving the landing
  // page mounted. Detect that case and force a reload.
  window.location.href = target;
  setTimeout(() => {
    if (document.readyState === 'complete' && !document.getElementById('content-area')) {
      window.location.reload();
    }
  }, 0);
}

// Route metadata. The `route` field is the router key (see
// src/lib/router.js pageLoaders); `label` is the displayed text; `isNew`
// adds the small "New" pill on the landing page header.
const NAV_ITEMS = [
  { label: 'Explore',       route: 'explore' },
  { label: 'Image',         route: 'image' },
  { label: 'Video',         route: 'video' },
  { label: 'Cinema',        route: 'cinema' },
  { label: 'Character',     route: 'character' },
  { label: 'Influencer',    route: 'influencer' },
  { label: 'Storyboard',    route: 'storyboard' },
  { label: 'Effects',       route: 'effects' },
  { label: 'Edit',          route: 'edit' },
  { label: 'Upscale',       route: 'upscale' },
  { label: 'Audio',         route: 'audio' },
  { label: 'Avatar',        route: 'avatar' },
  { label: 'Training',      route: 'training' },
  { label: 'Video Tools',   route: 'videotools' },
  { label: 'Render',        route: 'render' },
  { label: 'Video Agent',   route: 'video-agent' },
  { label: 'Director',      route: 'director' },
  { label: 'Timeline',      route: 'timeline' },
  { label: 'Chat',          route: 'chat' },
  { label: 'Commercial',    route: 'commercial' },
  { label: 'Templates',     route: 'templates' },
  { label: 'Library',       route: 'library' },
  { label: 'Community',     route: 'community' },
  { label: 'Assist',        route: 'assist' },
  { label: 'AI VFX',        route: 'ai-vfx' },
  { label: 'Apps',          route: 'apps', isNew: true },
];

const AUTH_LINKS = [
  // The auth pages (signin/signup) are served as static files by Netlify via
  // explicit redirects in netlify.toml, so a real `/signin` href is safe.
  { label: 'Sign In',    href: '/signin' },
];

const CTA_LINKS = [
  { label: 'Get Started', href: '/signup' },
];

function buildNavLink(item) {
  const a = document.createElement('a');
  a.className = 'py-1 px-3 text-[#e4e4e7] font-medium transition hover:text-[#22d3ee] text-sm whitespace-nowrap';
  a.href = `#/${item.route}`;
  a.textContent = item.label;
  if (item.isNew) {
    a.setAttribute('data-new', 'true');
    const pill = document.createElement('span');
    pill.className = 'ml-1.5 rounded-full text-xs font-medium whitespace-nowrap bg-cyan-400/20 text-cyan-400 px-1.5 py-0.5';
    pill.textContent = 'New';
    a.appendChild(pill);
  }
  a.addEventListener('click', (e) => {
    // Prevent the browser from following the `#/...` href as a fragment-only
    // navigation (which would scroll but skip our page-loader); route via the
    // hash router so the page component actually mounts.
    e.preventDefault();
    navigateOrReload(item.route);
  });
  return a;
}

export function LandingHeader() {
  const header = document.createElement('header');
  header.className = 'sticky top-0 z-50 w-full h-16 backdrop-blur-md bg-[#0a0b0f] border-b border-white/10';
  header.setAttribute('data-testid', 'landing-header');

  const nav = document.createElement('nav');
  nav.className = 'grid grid-cols-[1fr_auto_1fr] md:grid-cols-[auto_1fr_auto] pr-4 h-full items-center relative container';

  // Logo (home → in-app navigate to /apps, matches the main Header.js behavior)
  const logo = document.createElement('a');
  logo.href = '#/apps';
  logo.className = 'shrink-0 flex items-center gap-2 mr-2 transition hover:text-[#22d3ee] active:opacity-60';
  logo.innerHTML = `
    <div class="w-10 h-10 rounded-xl flex items-center justify-center border border-cyan-400/30 bg-cyan-400/10" style="box-shadow: 0 0 16px rgba(56,189,248,0.12);">
      <svg width="24" height="24" viewBox="0 0 80 80" fill="none">
        <rect width="80" height="80" rx="16" fill="#22d3ee"/>
        <path d="M32 22 L58 40 L32 58 Z" fill="#020205"/>
      </svg>
    </div>
    <span class="hidden md:block text-lg font-bold text-white">Timeline Editor</span>
  `;
  logo.addEventListener('click', (e) => {
    e.preventDefault();
    navigateOrReload('apps');
  });
  nav.appendChild(logo);

  // Primary navigation (hash-routed, in-app)
  const navList = document.createElement('div');
  navList.id = 'header__menu_list';
  navList.className = 'hidden md:grid grid-flow-col-dense items-center auto-cols-min overflow-x-auto hide-scrollbar gap-1';
  NAV_ITEMS.forEach((item) => navList.appendChild(buildNavLink(item)));
  nav.appendChild(navList);

  // Right-side auth actions
  const rightActions = document.createElement('div');
  rightActions.className = 'shrink-0 flex items-center gap-3';

  AUTH_LINKS.forEach((item) => {
    const a = document.createElement('a');
    a.href = item.href;
    a.className = 'px-4 py-2 text-sm text-[#e4e4e7] hover:text-[#22d3ee] transition font-medium';
    a.textContent = item.label;
    rightActions.appendChild(a);
  });

  CTA_LINKS.forEach((item) => {
    const a = document.createElement('a');
    a.href = item.href;
    a.className = 'px-4 py-2 text-sm bg-cyan-400 text-[#020205] hover:bg-cyan-300 transition font-medium';
    a.style.letterSpacing = '0.05em';
    a.style.textTransform = 'uppercase';
    a.textContent = item.label;
    rightActions.appendChild(a);
  });

  nav.appendChild(rightActions);
  header.appendChild(nav);
  return header;
}
