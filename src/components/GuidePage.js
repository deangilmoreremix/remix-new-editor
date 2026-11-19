// Onboarding guide (route: #/guide): a step-by-step "Get started" walkthrough. Each step is one studio, in the
// order a new person would try them, with its overview picture and a few feature screenshots from public/guides/.
// Linked from the banner at the top of the Apps page.
import { navigate } from '../lib/router.js';
import { createStudioHeader, demoteBannerHeading } from '../lib/thumbnails.js';
import { getStudioLabel } from '../lib/studioRoutes.js';
import { GUIDE_ROUTES, getGuide, featureLabel } from '../data/guideRoutes.js';

// slug -> what a new person does there. Order is the suggested first-use order.
export const GUIDE_STEPS = [
  ['image-studio', 'Start with a picture. Describe what you want, pick a model and press Generate.'],
  ['video-studio', 'Turn text or an image into a short video clip.'],
  ['cinema-studio', 'Add real camera, lens and movement controls for cinematic shots.'],
  ['character-studio', 'Keep the same face across every image you make.'],
  ['edit-studio', 'Fix and change images: remove objects or backgrounds, reframe, retouch.'],
  ['audio-studio', 'Make music, speech and sound effects for your videos.'],
  ['avatar-studio', 'Make a talking presenter from a photo and a voice.'],
  ['storyboard-studio', 'Plan a video as frames before you generate it.'],
  ['templates', 'Pick a ready-made template, add your media and generate.'],
  ['timeline-editor', 'Put clips together, add captions and export the finished video.'],
  ['library', 'Find everything you have made, in one place.'],
  ['smart-video-academy', 'Keep learning with short courses and example projects.'],
];

const FEATURES_PER_STEP = 3;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function openLightbox(src, caption) {
  const overlay = el('div', 'fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4 gap-3');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', caption);
  const img = el('img', 'max-w-full max-h-[85vh] rounded-xl border border-white/10');
  img.src = src;
  img.alt = caption;
  const text = el('p', 'text-white text-sm font-medium text-center', caption);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  const btn = el('button', 'absolute top-4 right-4 px-3 py-2 rounded-lg bg-white/10 text-white text-sm font-bold hover:bg-white/20', 'Close');
  btn.type = 'button';
  btn.onclick = close;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.append(btn, img, text);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
}

function shot(src, label, className) {
  const img = el('img', className);
  img.src = src;
  img.alt = label;
  img.loading = 'lazy';
  img.onclick = () => openLightbox(src, label);
  return img;
}

export function GuidePage() {
  const container = el('div', 'w-full h-full overflow-y-auto bg-app-bg');
  const inner = el('div', 'w-full px-4 md:px-6 py-6 flex flex-col gap-8 max-w-5xl mx-auto');
  container.appendChild(inner);

  inner.appendChild(demoteBannerHeading(createStudioHeader('academy', 'Get started', 'Twelve steps from your first picture to a finished video')));
  inner.appendChild(el('h1', 'sr-only', 'Get started'));

  const nav = el('nav', 'flex flex-wrap gap-2');
  nav.setAttribute('aria-label', 'Steps');
  inner.appendChild(nav);

  GUIDE_STEPS.forEach(([slug, blurb], i) => {
    const guide = getGuide(slug);
    const route = GUIDE_ROUTES[slug];
    if (!guide || !route) return;
    const name = getStudioLabel(route);

    const chip = el('a', 'px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-white hover:border-primary/50 hover:text-primary transition-colors', `${i + 1}. ${name}`);
    chip.href = `#step-${slug}`;
    chip.onclick = (e) => { e.preventDefault(); container.querySelector(`#step-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    nav.appendChild(chip);

    const step = el('section', 'flex flex-col gap-4 scroll-mt-4');
    step.id = `step-${slug}`;
    const head = el('div', 'flex flex-wrap items-center gap-3');
    head.appendChild(el('div', 'w-9 h-9 rounded-full bg-primary/15 text-primary text-sm font-black flex items-center justify-center shrink-0', String(i + 1)));
    const titles = el('div', 'min-w-0 flex-1');
    titles.appendChild(el('h2', 'text-xl font-black text-white', name));
    titles.appendChild(el('p', 'text-sm text-secondary', blurb));
    head.appendChild(titles);
    const open = el('button', 'px-4 py-2 rounded-xl bg-primary text-black text-sm font-bold hover:bg-[var(--color-primary-hover)] transition-colors', `Open ${name}`);
    open.type = 'button';
    open.onclick = () => navigate(route);
    head.appendChild(open);
    step.appendChild(head);

    if (guide.overview) step.appendChild(shot(guide.overview, `${name} overview`, 'w-full rounded-2xl border border-white/10 cursor-zoom-in'));

    const features = Object.entries(guide.features || {}).slice(0, FEATURES_PER_STEP);
    if (features.length) {
      const grid = el('div', 'grid grid-cols-1 sm:grid-cols-3 gap-3');
      features.forEach(([id, path]) => {
        const card = el('figure', 'm-0 bg-card-bg/90 border border-white/10 rounded-xl overflow-hidden');
        card.appendChild(shot(path, featureLabel(id), 'w-full aspect-video object-cover bg-white/5 cursor-zoom-in'));
        card.appendChild(el('figcaption', 'p-3 text-xs font-bold text-white', featureLabel(id)));
        grid.appendChild(card);
      });
      step.appendChild(grid);
    }
    inner.appendChild(step);
  });

  const done = el('div', 'flex flex-wrap items-center gap-3 pb-10');
  const apps = el('button', 'px-5 py-2.5 rounded-xl border border-white/15 text-white text-sm font-bold hover:border-primary/60 transition-colors', 'See all apps');
  apps.type = 'button';
  apps.onclick = () => navigate('apps');
  done.appendChild(apps);
  inner.appendChild(done);

  return container;
}
