// Repo Ecosystem Showcase — an interactive, filterable grid for the whole
// related-repo ecosystem: prompt libraries, model comparisons, SDKs, ComfyUI
// workflows, agent skills, and the curriculum.
//
// The data has two hidden axes — *type* (the category) and *model* (MiniMax H3,
// Seedance 2.5, FLUX 3, …). A flat card grid buries that, so this view exposes
// both: category tabs filter by type, model chips cross-cut every category, and
// each card is tinted by its model so relationships read at a glance.

import { escapeHtml, injectMinimaxStyles } from './minimax/ui.js';
import { revealOnScroll } from './minimax/mediaFrame.js';

const REPO_CATEGORIES = [
  {
    id: 'prompts',
    label: 'Prompt Libraries',
    repos: [
      {
        name: 'awesome-minimax-h3-prompts',
        url: 'https://github.com/Anil-matcha/awesome-minimax-h3-prompts',
        description: '30 MiniMax H3 video examples with runnable MuAPI prompts and previews.',
        tags: ['MiniMax H3', 'video', 'prompts'],
        model: 'MiniMax H3',
      },
      {
        name: 'awesome-seedance-2.5-api-prompts',
        url: 'https://github.com/Anil-matcha/awesome-seedance-2.5-api-prompts',
        description: 'Curated Seedance 2.5 prompt templates, camera controls, and cinematic examples.',
        tags: ['Seedance 2.5', 'prompts', 'camera'],
        model: 'Seedance 2.5',
      },
      {
        name: 'awesome-flux-3-api-prompts',
        url: 'https://github.com/Anil-matcha/awesome-flux-3-api-prompts',
        description: 'FLUX 3 API guide with image, video, editing, and e-commerce prompt templates.',
        tags: ['FLUX 3', 'prompts', 'image-to-video'],
        model: 'FLUX 3',
      },
      {
        name: 'awesome-claude-fable-5',
        url: 'https://github.com/Anil-matcha/awesome-claude-fable-5',
        description: '94 curated Claude Fable 5 use cases with real benchmarks and prompts.',
        tags: ['Claude', 'Fable 5', 'use cases'],
        model: 'Claude Fable 5',
      },
    ],
  },
  {
    id: 'comparisons',
    label: 'Model Comparisons',
    repos: [
      {
        name: 'awesome-ai-video-models',
        url: 'https://github.com/Anil-matcha/awesome-ai-video-models',
        description: 'Compare AI video models by API access, pricing, speed, and quality.',
        tags: ['video models', 'comparison', 'API'],
        model: null,
      },
      {
        name: 'awesome-ai-image-models',
        url: 'https://github.com/Anil-matcha/awesome-ai-image-models',
        description: 'Compare AI image models by API access, pricing, quality, and features.',
        tags: ['image models', 'comparison', 'API'],
        model: null,
      },
    ],
  },
  {
    id: 'sdks',
    label: 'SDKs & APIs',
    repos: [
      {
        name: 'MiniMax-H3-API',
        url: 'https://github.com/Anil-matcha/MiniMax-H3-API',
        description: 'Python SDK for MiniMax H3 text-to-video, image-to-video, and first/last-frame workflows.',
        tags: ['MiniMax H3', 'Python', 'SDK'],
        model: 'MiniMax H3',
      },
      {
        name: 'Wan-3.0-API',
        url: 'https://github.com/Anil-matcha/Wan-3.0-API',
        description: 'Python SDK and MCP server for Wan 3.0 text-to-video and multimodal references.',
        tags: ['Wan 3.0', 'Python', 'SDK', 'MCP'],
        model: 'Wan 3.0',
      },
      {
        name: 'Flux-3-Dev-API',
        url: 'https://github.com/Anil-matcha/Flux-3-Dev-API',
        description: 'Python wrapper for FLUX 3 Dev — text-to-image, image-to-image, text-to-video, image-to-video.',
        tags: ['FLUX 3', 'Python', 'SDK'],
        model: 'FLUX 3',
      },
      {
        name: 'Grok-Imagine-Image-2-API',
        url: 'https://github.com/Anil-matcha/Grok-Imagine-Image-2-API',
        description: 'Python SDK and MCP server for xAI image generation, editing, and multi-reference workflows.',
        tags: ['Grok', 'image', 'Python', 'SDK', 'MCP'],
        model: 'Grok',
      },
      {
        name: 'Seedance-2.5-API',
        url: 'https://github.com/SamurAIGPT/Seedance-2.5-API',
        description: 'Python wrapper for ByteDance Seedance 2.5 — text-to-video, image-to-video, character consistency.',
        tags: ['Seedance 2.5', 'Python', 'SDK'],
        model: 'Seedance 2.5',
      },
      {
        name: 'flux-3-video-api',
        url: 'https://github.com/SamurAIGPT/flux-3-video-api',
        description: 'Focused Python wrapper for FLUX 3 Text-to-Video and Image-to-Video with synchronized audio.',
        tags: ['FLUX 3', 'video', 'Python', 'SDK'],
        model: 'FLUX 3',
      },
    ],
  },
  {
    id: 'workflows',
    label: 'Workflows & Skills',
    repos: [
      {
        name: 'Generative-Media-Skills',
        url: 'https://github.com/SamurAIGPT/Generative-Media-Skills',
        description: '41+ agent skills for driving 200+ image/video models end-to-end from Claude Code, Codex, and Cursor.',
        tags: ['agents', 'skills', 'automation', 'workflows'],
        model: null,
      },
      {
        name: 'seedance2.5-comfyui',
        url: 'https://github.com/Anil-matcha/seedance2.5-comfyui',
        description: 'Native ComfyUI nodes and example workflows for Seedance 2.5 via MuAPI.',
        tags: ['Seedance 2.5', 'ComfyUI', 'workflows'],
        model: 'Seedance 2.5',
      },
      {
        name: 'seedance-2-mcp',
        url: 'https://github.com/Anil-matcha/seedance-2-mcp',
        description: 'MCP tools for driving Seedance 2 from Claude, Cursor, and other AI assistants.',
        tags: ['Seedance 2', 'MCP', 'agents'],
        model: 'Seedance 2',
      },
      {
        name: 'seedance-2.5-mcp',
        url: 'https://github.com/Anil-matcha/seedance-2.5-mcp',
        description: 'MCP tools for driving Seedance 2.5 from Claude, Cursor, and other AI assistants.',
        tags: ['Seedance 2.5', 'MCP', 'agents'],
        model: 'Seedance 2.5',
      },
    ],
  },
  {
    id: 'curriculum',
    label: 'Curriculum',
    repos: [
      {
        name: 'ai-creator-academy',
        url: 'https://github.com/Anil-matcha/ai-creator-academy',
        description: 'Free open-source curriculum for making money with generative AI image, video, and audio.',
        tags: ['curriculum', 'monetization', 'freelancing'],
        model: null,
      },
    ],
  },
];

// Stable, on-brand accent per model. Used for the card's left accent bar and
// the model badge so a viewer can scan "which model is this for" instantly.
const MODEL_THEME = {
  'MiniMax H3': { color: '#22d3ee', soft: 'rgba(34,211,238,0.12)' },
  'Seedance 2.5': { color: '#a78bfa', soft: 'rgba(167,139,250,0.12)' },
  'Seedance 2': { color: '#8b5cf6', soft: 'rgba(139,92,246,0.12)' },
  'FLUX 3': { color: '#fbbf24', soft: 'rgba(251,191,36,0.12)' },
  'Claude Fable 5': { color: '#fb7185', soft: 'rgba(251,113,133,0.12)' },
  'Wan 3.0': { color: '#34d399', soft: 'rgba(52,211,153,0.12)' },
  Grok: { color: '#f87171', soft: 'rgba(248,113,113,0.12)' },
};
const MULTI_THEME = { color: '#94a3b8', soft: 'rgba(148,163,184,0.12)' };
// Controls chip ordering; only models that actually appear are rendered.
const MODEL_ORDER = ['MiniMax H3', 'Seedance 2.5', 'Seedance 2', 'FLUX 3', 'Claude Fable 5', 'Wan 3.0', 'Grok'];

const TOTAL_REPOS = REPO_CATEGORIES.reduce((n, c) => n + c.repos.length, 0);
const MODELS_PRESENT = (() => {
  const s = new Set();
  REPO_CATEGORIES.forEach((c) => c.repos.forEach((r) => r.model && s.add(r.model)));
  return s;
})();

function repoCardHtml(repo, categoryId) {
  const theme = MODEL_THEME[repo.model] || MULTI_THEME;
  const modelBadge = repo.model
    ? `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold" style="color:${theme.color};border:1px solid ${theme.color}33;background:${theme.soft}">${escapeHtml(repo.model)}</span>`
    : '';

  return `
    <article
      class="mmx-card mmx-reveal relative flex flex-col overflow-hidden rounded-xl border border-white/8 bg-white/[0.025] p-5"
      data-category="${categoryId}"
      data-model="${escapeHtml(repo.model || '')}">
      <span class="pointer-events-none absolute inset-y-0 left-0 w-[3px]" style="background:${theme.color}" aria-hidden="true"></span>
      <div class="flex flex-1 flex-col">
        <div class="mb-3 flex min-h-[18px] items-center">${modelBadge}</div>
        <h3 class="text-sm font-bold leading-snug text-white">
          <a href="${escapeHtml(repo.url)}" target="_blank" rel="noopener noreferrer" class="hover:text-cyan-400 transition-colors">${escapeHtml(repo.name)}</a>
        </h3>
        <p class="mt-2 flex-1 text-xs leading-relaxed text-gray-400">${escapeHtml(repo.description)}</p>
        <div class="mt-4 flex flex-wrap gap-1.5">
          ${repo.tags
            .map(
              (t) =>
                `<span class="inline-flex items-center rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-gray-400">${escapeHtml(t)}</span>`,
            )
            .join('')}
        </div>
      </div>
    </article>`;
}

function statHtml(value, label) {
  return `
    <div class="flex flex-col items-center">
      <span class="text-2xl font-black text-cyan-300 md:text-3xl tabular-nums">${value}</span>
      <span class="mt-1 text-[11px] uppercase tracking-[0.14em] text-gray-500">${label}</span>
    </div>`;
}

export function RepoShowcase() {
  injectMinimaxStyles();

  const section = document.createElement('section');
  section.id = 'repo-ecosystem';
  section.className =
    'relative overflow-hidden bg-gradient-to-b from-[#020205] via-[#05070b] to-[#020205] px-5 py-20 sm:px-6 md:py-28';
  section.setAttribute('aria-labelledby', 'repo-ecosystem-heading');
  section.setAttribute('data-testid', 'repo-ecosystem');

  const container = document.createElement('div');
  container.className = 'container relative z-10 mx-auto max-w-7xl';

  // --- Heading ---------------------------------------------------------------
  const headingHtml = `
    <div class="mmx-reveal text-center mx-auto max-w-3xl mb-10">
      <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/[0.07] px-4 py-1.5">
        <span class="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
        <span class="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Ecosystem</span>
      </div>
      <h2 id="repo-ecosystem-heading" class="text-3xl font-black leading-[1.08] tracking-tight text-white md:text-4xl lg:text-5xl">
        Prompt Libraries, SDKs,<br/>and <span class="italic text-cyan-400">Workflow Templates</span>
      </h2>
      <p class="mt-5 text-base leading-relaxed text-gray-400 md:text-lg">
        The full toolkit behind the landing page demos — prompt references, model comparisons, Python SDKs, ComfyUI workflows, and agent skills.
      </p>
    </div>`;

  // --- Ecosystem stat strip --------------------------------------------------
  const statsHtml = `
    <div class="mmx-reveal flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
      ${statHtml(TOTAL_REPOS, 'Repositories')}
      <span class="hidden h-8 w-px bg-white/10 sm:block" aria-hidden="true"></span>
      ${statHtml(REPO_CATEGORIES.length, 'Categories')}
      <span class="hidden h-8 w-px bg-white/10 sm:block" aria-hidden="true"></span>
      ${statHtml(MODELS_PRESENT.size, 'Models Covered')}
    </div>`;

  // --- Filter bar ------------------------------------------------------------
  const categoryTabs = [{ id: 'all', label: 'All' }, ...REPO_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))]
    .map(
      (c) =>
        `<button type="button" class="mmx-filter-tab inline-flex items-center rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-gray-400 transition-colors" data-cat="${c.id}" aria-pressed="${c.id === 'all'}">${escapeHtml(c.label)}</button>`,
    )
    .join('');

  const modelChips = ['__all__', ...MODEL_ORDER.filter((m) => MODELS_PRESENT.has(m))]
    .map((m) => {
      if (m === '__all__') {
        return `<button type="button" class="mmx-filter-model inline-flex items-center gap-1.5 rounded-md border border-cyan-400/50 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-300 transition-colors" data-model="" aria-pressed="true">All Models</button>`;
      }
      const theme = MODEL_THEME[m];
      return `<button type="button" class="mmx-filter-model inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-[11px] font-medium text-gray-300 transition-colors" data-model="${escapeHtml(m)}" aria-pressed="false"><span class="h-2 w-2 rounded-full" style="background:${theme.color}" aria-hidden="true"></span>${escapeHtml(m)}</button>`;
    })
    .join('');

  const filterHtml = `
    <div class="mmx-reveal mt-12">
      <div class="mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.02] px-5 py-5">
        <div class="flex flex-wrap items-center justify-center gap-2">${categoryTabs}</div>
        <div class="h-px w-full bg-white/8" aria-hidden="true"></div>
        <div class="flex flex-wrap items-center justify-center gap-2">${modelChips}</div>
      </div>
      <p class="mmx-results mt-4 text-center text-xs text-gray-500" aria-live="polite"></p>
    </div>`;

  // --- Categorized grids -----------------------------------------------------
  const categoriesHtml = REPO_CATEGORIES.map(
    (cat) => `
      <div class="mmx-category mmx-reveal" data-cat="${cat.id}">
        <h3 class="mb-5 text-lg font-bold text-white md:text-xl">${escapeHtml(cat.label)}</h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5">
          ${cat.repos.map((r) => repoCardHtml(r, cat.id)).join('')}
        </div>
      </div>`,
  ).join('');

  container.innerHTML = `${headingHtml}${statsHtml}${filterHtml}<div class="mt-12 space-y-14">${categoriesHtml}</div>`;
  section.appendChild(container);

  // --- Filtering logic -------------------------------------------------------
  const resultsEl = container.querySelector('.mmx-results');
  let activeCategory = 'all';
  let activeModel = null;

  const show = (el) => {
    el.style.display = '';
  };
  const hide = (el) => {
    el.style.display = 'none';
  };

  function syncTabStyles() {
    container.querySelectorAll('.mmx-filter-tab').forEach((btn) => {
      const active = btn.dataset.cat === activeCategory;
      btn.classList.toggle('border-cyan-400/50', active);
      btn.classList.toggle('bg-cyan-400/10', active);
      btn.classList.toggle('text-cyan-300', active);
      btn.classList.toggle('border-white/10', !active);
      btn.classList.toggle('text-gray-400', !active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function syncModelStyles() {
    container.querySelectorAll('.mmx-filter-model').forEach((btn) => {
      const active = (activeModel || '') === (btn.dataset.model || '');
      btn.classList.toggle('border-cyan-400/50', active);
      btn.classList.toggle('bg-cyan-400/10', active);
      btn.classList.toggle('text-cyan-300', active);
      btn.classList.toggle('border-white/10', !active);
      btn.classList.toggle('text-gray-300', !active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function applyFilter() {
    const visible = [];
    container.querySelectorAll('.mmx-category').forEach((block) => {
      const blockVisible = activeCategory === 'all' || block.dataset.cat === activeCategory;
      let anyVisible = false;
      block.querySelectorAll('.mmx-card').forEach((card) => {
        const model = card.dataset.model || '';
        const modelOk = !activeModel || model === activeModel;
        const showCard = blockVisible && modelOk;
        if (showCard) {
          show(card);
          anyVisible = true;
          visible.push(card);
        } else {
          hide(card);
        }
      });
      if (anyVisible) show(block);
      else hide(block);
    });

    // Staggered re-pop so filter changes feel alive without being noisy.
    visible.forEach((card, i) => {
      card.classList.remove('mmx-pop');
      void card.offsetWidth; // restart the animation
      card.style.animationDelay = `${i * 28}ms`;
      card.classList.add('mmx-pop');
    });

    const filtered = activeCategory !== 'all' || activeModel;
    resultsEl.textContent = filtered ? `Showing ${visible.length} of ${TOTAL_REPOS} repositories` : '';
  }

  container.querySelectorAll('.mmx-filter-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      syncTabStyles();
      applyFilter();
    });
  });
  container.querySelectorAll('.mmx-filter-model').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeModel = btn.dataset.model || null;
      syncModelStyles();
      applyFilter();
    });
  });

  const disposeReveal = revealOnScroll(section.querySelectorAll('.mmx-reveal'), {
    stagger: 55,
  });

  section.cleanup = () => {
    disposeReveal();
  };

  return section;
}

export default RepoShowcase;
