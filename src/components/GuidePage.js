// Studio guide (route: #/guide/<slug>): the studio's overview picture and one screenshot per feature,
// from public/guides/<slug>/. Opened from the "Guide" link on each Apps-page card.
import { navigate } from '../lib/router.js';
import { createStudioHeader, demoteBannerHeading } from '../lib/thumbnails.js';
import { getStudioLabel } from '../lib/studioRoutes.js';
import { GUIDE_ROUTES, getGuide, featureLabel } from '../data/guideRoutes.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function slugFromHash() {
  const hash = typeof window === 'undefined' ? '' : window.location.hash;
  return decodeURIComponent(hash.replace(/^#\/?guide\//, '').split('?')[0].replace(/\/+$/, ''));
}

function openLightbox(src, caption) {
  const overlay = el('div', 'fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 gap-3');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', caption);
  const img = el('img', 'max-w-full max-h-[85vh] rounded-xl border border-white/10');
  img.src = src;
  img.alt = caption;
  const text = el('p', 'text-white text-sm font-medium text-center', caption);
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const btn = el('button', 'absolute top-4 right-4 px-3 py-2 rounded-lg bg-white/10 text-white text-sm font-bold hover:bg-white/20', 'Close');
  btn.type = 'button';
  btn.onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.append(btn, img, text);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
}

export function GuidePage(slugArg) {
  const slug = slugArg || slugFromHash();
  const guide = getGuide(slug);
  const route = GUIDE_ROUTES[slug];

  const container = el('div', 'w-full h-full overflow-y-auto bg-app-bg');
  const inner = el('div', 'w-full px-4 md:px-6 py-6 flex flex-col gap-6 max-w-6xl mx-auto');
  container.appendChild(inner);

  if (!guide || !route) {
    inner.append(el('h1', 'text-2xl font-black text-white', 'Guide not found'));
    const back = el('button', 'self-start px-4 py-2 rounded-lg border border-white/15 text-white text-sm font-bold hover:border-primary/60', 'Back to Apps');
    back.type = 'button';
    back.onclick = () => navigate('apps');
    inner.appendChild(back);
    return container;
  }

  const name = getStudioLabel(route);
  const features = Object.entries(guide.features || {});

  inner.appendChild(demoteBannerHeading(createStudioHeader(route, `${name} guide`, `${features.length} features, each with a screenshot`)));

  const actions = el('div', 'flex flex-wrap gap-2');
  const open = el('button', 'px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-bold shadow-glow hover:bg-[var(--color-primary-hover)] transition-colors', `Open ${name}`);
  open.type = 'button';
  open.onclick = () => navigate(route);
  const back = el('button', 'px-5 py-2.5 rounded-xl border border-white/15 text-white text-sm font-bold hover:border-primary/60 transition-colors', 'All apps');
  back.type = 'button';
  back.onclick = () => navigate('apps');
  actions.append(open, back);
  inner.appendChild(actions);

  inner.appendChild(el('h1', 'sr-only', `${name} guide`));

  if (guide.overview) {
    const section = el('section', 'flex flex-col gap-3');
    section.appendChild(el('h2', 'text-lg font-bold text-white', 'Overview'));
    const img = el('img', 'w-full rounded-2xl border border-white/10 cursor-zoom-in');
    img.src = guide.overview;
    img.alt = `${name} overview`;
    img.loading = 'lazy';
    img.onclick = () => openLightbox(guide.overview, `${name} overview`);
    section.appendChild(img);
    inner.appendChild(section);
  }

  const featuresSection = el('section', 'flex flex-col gap-3 pb-10');
  featuresSection.appendChild(el('h2', 'text-lg font-bold text-white', 'Features'));
  const grid = el('div', 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4');
  features.forEach(([id, path]) => {
    const label = featureLabel(id);
    const card = el('button', 'text-left bg-card-bg/90 border border-white/10 rounded-xl overflow-hidden hover:border-white/30 transition-colors group');
    card.type = 'button';
    const img = el('img', 'w-full aspect-video object-cover bg-white/5');
    img.src = path;
    img.alt = label;
    img.loading = 'lazy';
    card.append(img, el('div', 'p-3 text-sm font-bold text-white group-hover:text-primary transition-colors', label));
    card.onclick = () => openLightbox(path, label);
    grid.appendChild(card);
  });
  featuresSection.appendChild(grid);
  inner.appendChild(featuresSection);

  return container;
}
