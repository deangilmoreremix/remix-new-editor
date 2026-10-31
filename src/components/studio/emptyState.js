// Upstream Open-Generative-AI empty state: four overlapping tilted sample cards
// (the third one round) that straighten on hover, a two-line uppercase title
// with the model name in the primary colour, and a muted subtitle.

const CARD_BASE = 'border border-white/10 shadow-2xl transform hover:rotate-0 hover:scale-110 hover:z-20 transition-all duration-300 overflow-hidden bg-white/[0.01] flex-shrink-0';
const TILTS = [
  'w-[72px] h-[88px] sm:w-24 sm:h-28 rounded-2xl -rotate-[12deg]',
  'w-[72px] h-[88px] sm:w-24 sm:h-28 rounded-2xl -rotate-[4deg] -ml-3 sm:-ml-4',
  'w-[72px] h-[72px] sm:w-24 sm:h-24 rounded-full rotate-[6deg] -ml-3 sm:-ml-4',
  'w-[72px] h-[88px] sm:w-24 sm:h-28 rounded-2xl rotate-[12deg] -ml-3 sm:-ml-4',
];

/**
 * @param {object} opts
 * @param {string} opts.heading   — first line, e.g. "Start creating with"
 * @param {string} opts.highlight — second line in the primary colour (model name)
 * @param {string} [opts.subtitle]
 * @param {string[]} [opts.samples] — up to 4 image/video URLs
 */
export function createEmptyState({ heading = 'Start creating with', highlight = '', subtitle = '', samples = [] } = {}) {
  const root = document.createElement('div');
  root.className = 'flex flex-col items-center justify-center animate-fade-in-up transition-all duration-700 py-8';
  root.dataset.emptyState = '';

  const cards = document.createElement('div');
  cards.className = 'flex items-center justify-center gap-1.5 md:gap-3 mb-8 select-none';
  samples.filter(Boolean).slice(0, 4).forEach((src, i) => {
    const card = document.createElement('div');
    card.className = `${TILTS[i]} ${CARD_BASE}`;
    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(src);
    const media = document.createElement(isVideo ? 'video' : 'img');
    media.src = src;
    media.className = 'w-full h-full object-cover';
    if (isVideo) { media.muted = true; media.autoplay = true; media.loop = true; media.playsInline = true; }
    else { media.alt = ''; media.loading = 'lazy'; }
    // A sample that fails to load is dropped rather than shown as a broken tile.
    media.addEventListener('error', () => card.remove(), { once: true });
    card.appendChild(media);
    cards.appendChild(card);
  });
  if (cards.childElementCount) root.appendChild(cards);

  const title = document.createElement('h2');
  title.className = 'text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-center px-4 flex flex-col items-center';
  const line1 = document.createElement('span');
  line1.className = 'text-white font-black uppercase text-xl sm:text-3xl tracking-wide mb-1 opacity-90';
  line1.textContent = heading;
  const line2 = document.createElement('span');
  line2.className = 'text-primary font-black uppercase text-2xl sm:text-4xl sm:mt-1 tracking-tight';
  line2.dataset.emptyHighlight = '';
  line2.textContent = highlight;
  title.append(line1, line2);
  root.appendChild(title);

  if (subtitle) {
    const p = document.createElement('p');
    p.className = 'text-white/40 text-xs sm:text-sm font-medium tracking-wide text-center max-w-lg leading-relaxed px-4';
    p.textContent = subtitle;
    root.appendChild(p);
  }

  root.setHighlight = (text) => { line2.textContent = text; };
  return root;
}
