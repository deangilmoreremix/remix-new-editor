// SmartWarmupAI studio: email warmup, cold outreach, unified inbox, CRM and automations.
//
// Hosts the vendored upstream dashboard (apps/warmbly-web, rebranded at build time and built to public/smartwarmupai-app by
// `npm run build:smartwarmupai`) and its Help site (apps/smartwarmupai-help, built to public/smartwarmupai-help) in same-origin iframes,
// with a Dashboard / Help switch. The dashboard runs on recorded demo data until a real backend is configured; see
// apps/warmbly-web/UPSTREAM.md and apps/smartwarmupai-brand/README.md.
const APP = '/smartwarmupai-app';
const HELP = '/smartwarmupai-help';
// Studio deep links (#/smartwarmupai/<view>) → dashboard routes. #/smartwarmupai/help[/<docs path>] opens the Help site.
const VIEW_ROUTES = {
  dashboard: '/app/analytics', campaigns: '/app/campaigns', inbox: '/app/unibox', contacts: '/app/contacts',
  pipeline: '/app/crm/deals', mailboxes: '/app/emails', deliverability: '/app/deliverability',
  automations: '/app/automations', integrations: '/app/integrations', settings: '/app/settings/profile',
};

async function isBuilt(base) {
  try {
    const res = await fetch(`${base}/index.html`, { cache: 'no-store' });
    if (!res.ok) return false;
    // A dev server answers unknown paths with the host's own page, so confirm it is the built site.
    return (await res.text()).includes(`${base}/`);
  } catch {
    return false;
  }
}

// The dashboard opens in its light theme. SmartVideo is dark, so default it to the dashboard's own dark theme.
// 'theme-default' is the dashboard's brand-default setting (apps/warmbly-web/src/lib/theme.ts), read before first paint;
// a theme the viewer picked themselves ('theme') always wins, so this never overrides their choice.
function defaultToDarkTheme() {
  try {
    if (!localStorage.getItem('theme')) localStorage.setItem('theme-default', 'dark');
  } catch {
    // No storage: the dashboard keeps its own default.
  }
}

// The frame's colour until the dashboard paints: dark unless the viewer explicitly chose light.
function frameBackground() {
  try {
    return localStorage.getItem('theme') === 'light' ? '#fff' : '#111214';
  } catch {
    return '#111214';
  }
}

export function SmartWarmupAIStudio() {
  defaultToDarkTheme();
  const container = document.createElement('div');
  Object.assign(container.style, { width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' });
  // Pin to the viewport below the header (the app shell grows with the sidebar).
  const fit = () => {
    const header = document.querySelector('#app > header, header');
    const top = header ? Math.round(header.getBoundingClientRect().height) : 56;
    container.style.height = `calc(100dvh - ${top}px)`;
    container.style.position = 'sticky';
    container.style.top = `${top}px`;
  };
  fit();
  requestAnimationFrame(fit);
  window.addEventListener('resize', fit);

  const bar = document.createElement('div');
  Object.assign(bar.style, { display: 'flex', gap: '4px', padding: '6px 10px', borderBottom: '1px solid rgba(128,128,128,.25)', background: 'rgba(128,128,128,.06)' });
  const mkTab = (label, key) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.tab = key;
    Object.assign(b.style, { padding: '4px 12px', borderRadius: '8px', border: '0', background: 'transparent', color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: '13px', opacity: '.7' });
    return b;
  };
  const tabApp = mkTab('Dashboard', 'app'); const tabHelp = mkTab('Help', 'help'); bar.append(tabApp, tabHelp);
  const host = document.createElement('div');
  Object.assign(host.style, { position: 'relative', flex: '1 1 0%', minHeight: '0', height: '100%' });
  container.append(bar, host);

  const frames = {};
  let disposed = false;
  const makeFrame = (key, src, title) => {
    const f = document.createElement('iframe'); f.src = src; f.title = title; f.dataset.frame = key;
    f.setAttribute('allow', 'clipboard-read; clipboard-write; fullscreen');
    Object.assign(f.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', border: '0', background: frameBackground(), display: 'none' });
    host.appendChild(f); frames[key] = f; return f;
  };
  const show = (key, src) => {
    if (src && frames[key]) frames[key].src = src;
    for (const [k, f] of Object.entries(frames)) f.style.display = k === key ? 'block' : 'none';
    for (const b of [tabApp, tabHelp]) { const on = b.dataset.tab === key; b.style.opacity = on ? '1' : '.7'; b.style.fontWeight = on ? '600' : '400'; b.style.background = on ? 'rgba(128,128,128,.18)' : 'transparent'; b.setAttribute('aria-pressed', String(on)); }
  };
  tabApp.onclick = () => show('app');
  tabHelp.onclick = () => show('help');

  const hash = window.location.hash.match(/#\/smartwarmupai\/([\w/-]+)/)?.[1] || '';
  const wantsHelp = hash === 'help' || hash.startsWith('help/');
  (async () => {
    const [appBuilt, helpBuilt] = await Promise.all([isBuilt(APP), isBuilt(HELP)]);
    if (disposed) return;
    if (!appBuilt) {
      host.textContent = 'The SmartWarmupAI dashboard has not been built yet. Run `npm run build:smartwarmupai`.';
      Object.assign(host.style, { padding: '24px' });
      return;
    }
    const appFrame = makeFrame('app', `${APP}${VIEW_ROUTES[hash] || '/app/emails'}`, 'SmartWarmupAI');
    if (helpBuilt) {
      makeFrame('help', `${HELP}/${wantsHelp ? hash.slice(5).replace(/^\//, '') : ''}`, 'SmartWarmupAI Help');
      // A help link clicked inside the dashboard opens the Help tab instead of a new browser tab.
      appFrame.addEventListener('load', () => {
        try {
          appFrame.contentDocument.addEventListener('click', (e) => {
            const a = e.target.closest && e.target.closest(`a[href^="${HELP}/"]`);
            if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault(); e.stopPropagation();
            show('help', a.getAttribute('href'));
          }, true);
        } catch { /* cross-origin dashboard: links open normally */ }
      });
    } else tabHelp.style.display = 'none';
    show(wantsHelp && helpBuilt ? 'help' : 'app');
  })();

  container.cleanup = () => { disposed = true; window.removeEventListener('resize', fit); };
  return container;
}

export default SmartWarmupAIStudio;
