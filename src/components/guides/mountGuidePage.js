// Mounts the public studio guide pages (/studios and /studios/<slug>).
// No app shell, no sign-in. The same HTML is prerendered at build time by
// scripts/build-studio-guides.mjs so search engines see the full content.
import { GUIDES, GUIDES_BY_CATEGORY, getGuide } from '../../data/studioGuides.js';
import { GUIDE_CSS, renderGuideHtml, renderHubHtml, guideHead, wireTourVideo } from './renderGuide.js';
import { wireAppShowcase } from './appShowcase.js';

function setMeta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function applyHead(h) {
  document.title = h.title;
  setMeta('name', 'title', h.title);
  setMeta('name', 'description', h.description);
  setMeta('name', 'keywords', h.keywords);
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = h.canonical;
  for (const [k, v] of [['og:title', h.title], ['og:description', h.description], ['og:url', h.canonical], ['og:image', h.image], ['og:type', 'website']]) setMeta('property', k, v);
  for (const [k, v] of [['twitter:card', 'summary_large_image'], ['twitter:title', h.title], ['twitter:description', h.description], ['twitter:image', h.image]]) setMeta('name', k, v);
  document.head.querySelectorAll('script[data-guide-ld]').forEach((s) => s.remove());
  for (const j of h.jsonLd) {
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-guide-ld', '');
    s.textContent = JSON.stringify(j);
    document.head.appendChild(s);
  }
}

/** @param {HTMLElement} app  @param {string} slug  '' for the hub */
export function mountGuidePage(app, slug) {
  if (!document.getElementById('studio-guide-css')) {
    const style = document.createElement('style');
    style.id = 'studio-guide-css';
    style.textContent = GUIDE_CSS;
    document.head.appendChild(style);
  }
  const guide = slug ? getGuide(slug) : null;
  if (slug && !guide && window.location.pathname !== '/studios/') {
    window.history.replaceState(null, '', '/studios/');
  }
  // A renamed guide keeps its old address working: show the new one in the address bar.
  if (guide && slug && guide.slug !== slug) window.history.replaceState(null, '', `/studios/${guide.slug}/`);
  app.innerHTML = guide ? renderGuideHtml(guide, GUIDES.length) : renderHubHtml(GUIDES_BY_CATEGORY, GUIDES.length, slug && !guide ? slug : '');
  if (guide) wireTourVideo(app);
  applyHead(guideHead(guide, window.location.origin, GUIDES_BY_CATEGORY));
  if (guide?.appsShowcase) wireAppShowcase(app); // the Edit Studio guide: app search, filters and the live preview

  const hash = window.location.hash.slice(1); // an in-page anchor; `#/route` hashes are routes, not anchors
  if (hash && !hash.startsWith('/')) document.getElementById(hash)?.scrollIntoView();
  else window.scrollTo(0, 0);

  // Ask SmartVideo on the guide pages too, set to this guide's studio (the hub gets general help).
  // Loaded after the page so it never delays the guide content.
  import('../../features/ask-smartvideo/AskSmartVideo.js')
    .then((m) => m.mountAskSmartVideo({
      navigate: (page) => { window.location.href = `/${page}`; },
      getPage: () => (guide ? guide.route : ''),
      onGuidePage: true,
    }))
    // The guide works without the assistant; just note why it is missing.
    .catch((err) => console.warn('[GuidePage] Ask SmartVideo failed to load:', err));
}
