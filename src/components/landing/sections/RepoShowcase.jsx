// Repo Ecosystem Showcase — cards for all related repos, organized by
// category. This surfaces prompt libraries, model comparisons, SDKs, and
// workflow templates alongside the existing video galleries.

import { escapeHtml, injectMinimaxStyles } from './minimax/ui.js';
import { revealOnScroll } from './minimax/mediaFrame.js';

const REPO_CATEGORIES = [
  {
    id: 'prompts',
    label: 'Prompt Libraries',
    repos: [
      {
        name: 'awesome-minimax-h3-prompts',
        url: 'https://github.com/BeatAPI/awesome-minimax-h3-prompts',
        description: '254 English MiniMax H3 video examples with source-verified prompts, attached videos, and BeatAPI-hosted previews.',
        tags: ['MiniMax H3', 'BeatAPI', 'video', 'prompts', '254 demos'],
      },
      {
        name: 'awesome-seedance-2.5-prompts',
        url: 'https://github.com/BeatAPI/awesome-seedance-2-5-prompts',
        description: '250 English Seedance 2.5 prompts with runnable API calls, source-verified outputs, and attached reference videos.',
        tags: ['Seedance 2.5', 'BeatAPI', 'prompts', 'video', '250 demos'],
      },
      {
        name: 'awesome-seedance',
        url: 'https://github.com/ZeroLu/awesome-seedance',
        description: '17 Seedance 2.0 reference videos and 19 English use-case prompts across cinema, commercial, social, and animation styles.',
        tags: ['Seedance 2.0', 'ZeroLu', 'reference videos', '17 demos'],
      },
      {
        name: 'awesome-flux-3-api-prompts',
        url: 'https://github.com/Anil-matcha/awesome-flux-3-api-prompts',
        description: 'FLUX 3 API guide with image, video, editing, and e-commerce prompt templates.',
        tags: ['FLUX 3', 'prompts', 'image-to-video'],
      },
      {
        name: 'awesome-claude-fable-5',
        url: 'https://github.com/Anil-matcha/awesome-claude-fable-5',
        description: '94 curated Claude Fable 5 use cases with real benchmarks and prompts.',
        tags: ['Claude', 'Fable 5', 'use cases'],
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
      },
      {
        name: 'awesome-ai-image-models',
        url: 'https://github.com/Anil-matcha/awesome-ai-image-models',
        description: 'Compare AI image models by API access, pricing, quality, and features.',
        tags: ['image models', 'comparison', 'API'],
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
      },
      {
        name: 'Wan-3.0-API',
        url: 'https://github.com/Anil-matcha/Wan-3.0-API',
        description: 'Python SDK and MCP server for Wan 3.0 text-to-video and multimodal references.',
        tags: ['Wan 3.0', 'Python', 'SDK', 'MCP'],
      },
      {
        name: 'Flux-3-Dev-API',
        url: 'https://github.com/Anil-matcha/Flux-3-Dev-API',
        description: 'Python wrapper for FLUX 3 Dev — text-to-image, image-to-image, text-to-video, image-to-video.',
        tags: ['FLUX 3', 'Python', 'SDK'],
      },
      {
        name: 'Grok-Imagine-Image-2-API',
        url: 'https://github.com/Anil-matcha/Grok-Imagine-Image-2-API',
        description: 'Python SDK and MCP server for xAI image generation, editing, and multi-reference workflows.',
        tags: ['Grok', 'image', 'Python', 'SDK', 'MCP'],
      },
      {
        name: 'Seedance-2.5-API',
        url: 'https://github.com/SamurAIGPT/Seedance-2.5-API',
        description: 'Python wrapper for ByteDance Seedance 2.5 — text-to-video, image-to-video, character consistency.',
        tags: ['Seedance 2.5', 'Python', 'SDK'],
      },
      {
        name: 'flux-3-video-api',
        url: 'https://github.com/SamurAIGPT/flux-3-video-api',
        description: 'Focused Python wrapper for FLUX 3 Text-to-Video and Image-to-Video with synchronized audio.',
        tags: ['FLUX 3', 'video', 'Python', 'SDK'],
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
      },
      {
        name: 'seedance2.5-comfyui',
        url: 'https://github.com/Anil-matcha/seedance2.5-comfyui',
        description: 'Native ComfyUI nodes and example workflows for Seedance 2.5 via MuAPI.',
        tags: ['Seedance 2.5', 'ComfyUI', 'workflows'],
      },
      {
        name: 'seedance-2-mcp',
        url: 'https://github.com/Anil-matcha/seedance-2-mcp',
        description: 'MCP tools for driving Seedance 2 from Claude, Cursor, and other AI assistants.',
        tags: ['Seedance 2', 'MCP', 'agents'],
      },
      {
        name: 'seedance-2.5-mcp',
        url: 'https://github.com/Anil-matcha/seedance-2.5-mcp',
        description: 'MCP tools for driving Seedance 2.5 from Claude, Cursor, and other AI assistants.',
        tags: ['Seedance 2.5', 'MCP', 'agents'],
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
      },
    ],
  },
];

function createRepoCard(repo) {
  const card = document.createElement('article');
  card.className =
    'mmx-card mmx-reveal flex flex-col overflow-hidden rounded-xl border border-white/8 bg-white/[0.025] p-5';

  card.innerHTML = `
    <div class="flex flex-1 flex-col">
      <h3 class="text-sm font-bold leading-snug text-white">
        <a href="${escapeHtml(repo.url)}" target="_blank" rel="noopener noreferrer" class="hover:text-cyan-400 transition-colors">
          ${escapeHtml(repo.name)}
        </a>
      </h3>
      <p class="mt-2 flex-1 text-xs leading-relaxed text-gray-400">${escapeHtml(repo.description)}</p>
      <div class="mt-4 flex flex-wrap gap-1.5">
        ${repo.tags.map((tag) => `<span class="inline-flex items-center rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-gray-400">${escapeHtml(tag)}</span>`).join('')}
      </div>
    </div>
  `;

  return card;
}

export function RepoShowcase() {
  try {
    injectMinimaxStyles();
  } catch (styleErr) {
    console.warn('[RepoShowcase] injectMinimaxStyles skipped:', styleErr);
  }

  const section = document.createElement('section');
  section.id = 'repo-ecosystem';
  section.className =
    'relative overflow-hidden bg-gradient-to-b from-[#020205] via-[#05070b] to-[#020205] px-5 py-20 sm:px-6 md:py-28';
  section.setAttribute('aria-labelledby', 'repo-ecosystem-heading');
  section.setAttribute('data-testid', 'repo-ecosystem');

  const container = document.createElement('div');
  container.className = 'container relative z-10 mx-auto max-w-7xl';

  container.innerHTML = `
    <div class="mmx-reveal text-center mx-auto max-w-3xl mb-14">
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
    </div>
  `;

  const categoriesRoot = document.createElement('div');
  categoriesRoot.className = 'mt-12 space-y-14';

  for (const category of REPO_CATEGORIES) {
    const categoryBlock = document.createElement('div');
    categoryBlock.className = 'mmx-reveal';

    const heading = document.createElement('h3');
    heading.className = 'text-lg font-bold text-white md:text-xl mb-5';
    heading.textContent = category.label;
    categoryBlock.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-5';

    for (const repo of category.repos) {
      grid.appendChild(createRepoCard(repo));
    }

    categoryBlock.appendChild(grid);
    categoriesRoot.appendChild(categoryBlock);
  }

  container.appendChild(categoriesRoot);
  section.appendChild(container);

  const disposeReveal = revealOnScroll(section.querySelectorAll('.mmx-reveal'), {
    stagger: 55,
  });

  section.cleanup = () => {
    disposeReveal();
  };

  return section;
}

export default RepoShowcase;
