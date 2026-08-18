// Shared UI atoms for the MiniMax H3 landing sections.
//
// Keeps CTA routing in exactly one place and matches the existing landing page
// design language (cyan-400 accent on #020205, white/5 glass surfaces,
// font-black headlines with an italic cyan emphasis span).

import { navigate } from '../../../../lib/router.js';
import { getCreateTarget } from '../../../../data/minimaxH3Demos.js';

let stylesInjected = false;

/**
 * Injects the small amount of CSS the MiniMax sections need that Tailwind
 * utilities cannot express (reveal transitions, snap carousel, hidden
 * scrollbars, hover-scrub affordances). Injected once per page.
 */
export function injectMinimaxStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  stylesInjected = true;

  const style = document.createElement('style');
  style.id = 'mmx-styles';
  style.textContent = `
    .mmx-reveal {
      opacity: 0;
      transform: translateY(24px);
      transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
                  transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
      will-change: opacity, transform;
    }
    .mmx-reveal.mmx-revealed {
      opacity: 1;
      transform: translateY(0);
    }

    /* Cinematic media frame: crisp dark edge, no heavy borders or glow. */
    .mmx-frame {
      isolation: isolate;
      background-color: #05070b;
      transform: translateZ(0);
    }
    .mmx-frame video,
    .mmx-frame img {
      -webkit-user-select: none;
      user-select: none;
    }

    .mmx-card {
      transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1),
                  border-color 0.4s ease,
                  background-color 0.4s ease;
    }
    @media (hover: hover) and (pointer: fine) {
      .mmx-card:hover { transform: translateY(-4px); }
      .mmx-card:hover .mmx-frame img { transform: scale(1.03); }
    }
    .mmx-frame img { transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1); }

    .mmx-card:focus-within {
      border-color: rgba(34, 211, 238, 0.45);
    }

    /* Mobile snap carousel */
    .mmx-scroller {
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      overscroll-behavior-x: contain;
    }
    .mmx-scroller::-webkit-scrollbar { display: none; }
    .mmx-snap { scroll-snap-align: center; }

    /* Prompt modal */
    .mmx-modal-backdrop {
      opacity: 0;
      transition: opacity 0.25s ease;
    }
    .mmx-modal-backdrop.mmx-open { opacity: 1; }
    .mmx-modal-panel {
      opacity: 0;
      transform: translateY(16px) scale(0.985);
      transition: opacity 0.3s cubic-bezier(0.22, 1, 0.36, 1),
                  transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .mmx-modal-backdrop.mmx-open .mmx-modal-panel {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .mmx-prompt-scroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(34, 211, 238, 0.3) transparent;
    }
    .mmx-prompt-scroll::-webkit-scrollbar { width: 8px; }
    .mmx-prompt-scroll::-webkit-scrollbar-track { background: transparent; }
    .mmx-prompt-scroll::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.14);
      border-radius: 9999px;
    }

    /* Workflow chips pulse in sequence (section 3) */
    @keyframes mmxChipPulse {
      0%, 100% { border-color: rgba(255,255,255,0.10); background-color: rgba(255,255,255,0.04); }
      50%      { border-color: rgba(34,211,238,0.55); background-color: rgba(34,211,238,0.10); }
    }
    .mmx-chip-active {
      animation: mmxChipPulse 2.4s ease-in-out infinite;
    }

    /* RepoShowcase filterable grid */
    @keyframes mmxPop {
      from { opacity: 0; transform: translateY(10px) scale(0.985); }
      to   { opacity: 1; transform: none; }
    }
    .mmx-card.mmx-pop { animation: mmxPop 0.42s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .mmx-filter-tab, .mmx-filter-model { cursor: pointer; }
    .mmx-filter-tab:focus-visible,
    .mmx-filter-model:focus-visible {
      outline: none;
      box-shadow: 0 0 0 2px rgba(34, 211, 238, 0.5);
    }

    @media (prefers-reduced-motion: reduce) {
      .mmx-card.mmx-pop { animation: none; }
      .mmx-reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
      .mmx-card, .mmx-frame img { transition: none !important; }
      .mmx-card:hover { transform: none !important; }
      .mmx-chip-active { animation: none !important; border-color: rgba(34,211,238,0.45) !important; }
      .mmx-modal-backdrop, .mmx-modal-panel { transition: none !important; }
    }
  `;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------- CTA links */

/**
 * The standalone landing route never calls initRouter() (src/main.js returns
 * early before the app shell is built), so the in-app navigate() is a no-op
 * there. Detect a live router by the app shell's content area.
 */
function routerIsMounted() {
  return typeof document !== 'undefined' && !!document.getElementById('content-area');
}

/**
 * Sends the visitor to a studio.
 *
 * Inside the app shell we use the hash router. From the standalone landing page
 * we do a real page load so main.js can boot the shell and route — the same
 * approach the existing auth pages use (see landing/SignUpPage.jsx).
 */
export function goToRoute(route, params = {}) {
  if (routerIsMounted()) {
    navigate(route, params);
    return;
  }
  const query = new URLSearchParams(params).toString();
  window.location.assign(query ? `/?${query}#/${route}` : `/#/${route}`);
}


/**
 * "Create This Style" CTA.
 *
 * Rendered as a real anchor so it is bookmarkable and middle-click friendly,
 * but a primary click stages a studio prefill (prompt + model + aspect ratio)
 * and navigates in-app so the destination studio opens pre-filled. A plain
 * `/commercial` request would 404 on the server (hash router), and even within
 * the SPA the studio only reads the prefill we stage here.
 */
export function createStyleLink(demo, options = {}) {
  const { label = 'Create This Style', variant = 'primary', block = false } = options;
  const target = getCreateTarget(demo);

  const link = document.createElement('a');
  link.href = target.href;
  link.dataset.mmxCta = 'create-style';
  link.dataset.mmxRoute = target.route;

  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020205]';

  const variants = {
    primary:
      'px-4 py-2 bg-cyan-400 text-[#020205] hover:bg-cyan-300 shadow-lg shadow-cyan-400/20 hover:shadow-cyan-300/30',
    ghost:
      'px-4 py-2 border border-white/12 text-white/85 hover:border-cyan-400/50 hover:text-white hover:bg-cyan-400/10',
    quiet:
      'px-0 py-0 text-cyan-400 hover:text-cyan-300 underline-offset-4 hover:underline',
  };

  link.className = `${base} ${variants[variant] || variants.primary} ${block ? 'w-full' : ''}`.trim();
  link.innerHTML = `
    <span>${escapeHtml(label)}</span>
    <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
    </svg>`;
  link.setAttribute('aria-label', `${label}: ${demo.title}`);

  link.addEventListener('click', async (event) => {
    // Preserve modifier-click / middle-click behaviour (open in new tab).
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    // Stage the prefill and route in-app. The destination studio loads the
    // prompt text lazily from minimaxH3Prompts; we pass what we can now.
    const { openDemoInStudio } = await import('../../../../data/minimaxH3Demos.js');
    await openDemoInStudio(demo);
  });

  return link;
}

/** "View Prompt" trigger — a real <button>, never a div with a handler. */
export function createViewPromptButton(demo, onOpen, options = {}) {
  const { label = 'View Prompt', variant = 'ghost' } = options;

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.mmxCta = 'view-prompt';
  button.dataset.mmxSlug = demo.slug;

  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#020205]';
  const variants = {
    ghost: 'px-4 py-2 border border-white/12 text-white/85 hover:border-cyan-400/50 hover:text-white hover:bg-white/5',
    quiet: 'text-white/60 hover:text-white',
  };

  button.className = `${base} ${variants[variant] || variants.ghost}`;
  button.innerHTML = `
    <svg class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 6h9M8 12h9M8 18h5M4 6h.01M4 12h.01M4 18h.01"/>
    </svg>
    <span>${escapeHtml(label)}</span>`;
  button.setAttribute('aria-label', `View the full generation prompt for ${demo.title}`);
  button.setAttribute('aria-haspopup', 'dialog');

  button.addEventListener('click', () => onOpen(demo, button));

  return button;
}

/* --------------------------------------------------------------------- atoms */

export function categoryBadge(text, options = {}) {
  const { tone = 'cyan' } = options;
  const tones = {
    cyan: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-300',
    neutral: 'border-white/12 bg-white/5 text-white/70',
    // Academy source badge. `--color-accent` (#a855f7) lives in variables.css
    // :root but is not registered in global.css @theme, so there is no
    // `border-accent`/`bg-accent` utility — arbitrary properties keep the badge
    // token-driven without relying on an opacity modifier over a CSS var.
    purple:
      '[border-color:color-mix(in_srgb,var(--color-accent)_30%,transparent)] [background-color:color-mix(in_srgb,var(--color-accent)_12%,transparent)] [color:var(--color-accent)]',
  };
  return `<span class="inline-flex items-center rounded-full border ${tones[tone] || tones.cyan} px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]">${escapeHtml(text)}</span>`;
}

export function metaPill(text) {
  return `<span class="inline-flex items-center rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/80 backdrop-blur-sm">${escapeHtml(text)}</span>`;
}

/**
 * Section heading in the established landing style: small cyan eyebrow, a
 * font-black headline where the accent clause is italic cyan, then a subtitle.
 */
export function sectionHeading({ eyebrow, title, accent, subtitle, id, align = 'center' }) {
  const alignment = align === 'left' ? 'text-left' : 'text-center mx-auto';
  return `
    <div class="mmx-reveal ${alignment} max-w-3xl ${align === 'center' ? 'mb-14' : 'mb-10'}">
      ${
        eyebrow
          ? `<div class="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.07] px-4 py-1.5">
               <span class="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
               <span class="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">${escapeHtml(eyebrow)}</span>
             </div>`
          : ''
      }
      <h2 ${id ? `id="${id}"` : ''} class="text-3xl font-black leading-[1.08] tracking-tight text-white md:text-4xl lg:text-5xl">
        ${escapeHtml(title)}${accent ? `<br/><span class="italic text-cyan-400">${escapeHtml(accent)}</span>` : ''}
      </h2>
      ${subtitle ? `<p class="mt-5 text-base leading-relaxed text-gray-400 md:text-lg">${escapeHtml(subtitle)}</p>` : ''}
    </div>`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
