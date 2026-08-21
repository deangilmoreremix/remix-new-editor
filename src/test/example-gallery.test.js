import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock router so navigate is controlled in tests.
vi.mock('../lib/router.js', () => ({
  navigate: vi.fn(),
}));

// Use vi.hoisted so mock data is initialized before any vi.mock factory runs.
const { mockMinimaxDemos, mockAcademyAdapters } = vi.hoisted(() => {
  return {
    mockMinimaxDemos: [
      {
        slug: 'luxury-perfume-commercial',
        title: 'Luxury perfume commercial',
        category: 'Commercial',
        tags: ['product', 'luxury'],
        sourceAuthor: '@CaliraVal',
        sourceUrl: 'https://x.com/CaliraVal/status/2083059583308751079',
      },
    ],
    mockAcademyAdapters: [
      {
        id: 'gripmount-ad2-problem-first',
        studio: 'commercial',
        prompt: 'UGC commercial ad opening',
        stylePreset: 'UGC',
        aspectRatio: '9:16',
        duration: 15,
        tags: ['ugc', 'commercial'],
      },
    ],
  };
});

vi.mock('../data/minimaxH3Demos.js', () => ({
  get minimaxH3Demos() { return mockMinimaxDemos; },
  MINIMAX_MODEL: 'MiniMax Hailuo 3 (H3)',
  getCreateTarget: (demo) => ({
    route: 'commercial',
    params: { template: `minimax-h3-${demo.slug}`, ref: 'minimax-h3' },
    href: `/?template=minimax-h3-${demo.slug}&ref=minimax-h3#/commercial`,
  }),
  loadDemoPrompt: vi.fn(async (slug) => `Mocked prompt for ${slug}`),
  CATEGORY_ROUTES: { Commercial: 'commercial' },
  DEFAULT_CREATE_ROUTE: 'video',
  TEMPLATE_PREFIX: 'minimax-h3-',
}));

vi.mock('../data/academyStudioAdapters.js', () => ({
  get ACADEMY_STUDIO_ADAPTERS() { return mockAcademyAdapters; },
  getAcademyCreateTarget: (assetId) => {
    const adapter = mockAcademyAdapters.find((a) => a.id === assetId);
    if (!adapter) return null;
    return {
      route: adapter.studio,
      params: {
        prompt: adapter.prompt,
        style: adapter.stylePreset,
        aspect_ratio: adapter.aspectRatio,
        duration: adapter.duration,
        'academy-template': assetId,
      },
    };
  },
  getAcademyAssetsForStudio: (studioId) =>
    mockAcademyAdapters.filter((a) => a.studio === studioId),
}));

import { handleCreateThisStyle, handleViewPrompt } from '../lib/exampleGalleryBridge.js';
import { getAssetsForStudio, getAssetById, getAllExampleAssets } from '../data/exampleGalleryAssets.js';
import { getMinimaxTemplateById, getAllMinimaxTemplates } from '../lib/minimaxTemplates.js';
import { getAcademyCreateTarget, getAcademyAssetsForStudio } from '../data/academyStudioAdapters.js';
import ExampleGallery from '../components/studios/ExampleGallery.js';

describe('exampleGalleryBridge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('handleCreateThisStyle', () => {
    it('navigates to the MiniMax create target for minimax source', async () => {
      const { navigate } = await import('../lib/router.js');
      const asset = { source: 'minimax', slug: 'luxury-perfume-commercial', title: 'Luxury perfume commercial' };
      await handleCreateThisStyle(asset);
      expect(navigate).toHaveBeenCalledWith('commercial', {
        template: 'minimax-h3-luxury-perfume-commercial',
        ref: 'minimax-h3',
      });
    });

    it('navigates to the academy create target for academy source', async () => {
      const { navigate } = await import('../lib/router.js');
      const asset = { source: 'academy', id: 'gripmount-ad2-problem-first' };
      await handleCreateThisStyle(asset);
      expect(navigate).toHaveBeenCalledWith('commercial', {
        prompt: 'UGC commercial ad opening',
        style: 'UGC',
        aspect_ratio: '9:16',
        duration: 15,
        'academy-template': 'gripmount-ad2-problem-first',
      });
    });

    it('falls back to video with empty prompt for unknown academy asset', async () => {
      const { navigate } = await import('../lib/router.js');
      const asset = { source: 'academy', id: 'unknown-asset-id' };
      await handleCreateThisStyle(asset);
      expect(navigate).toHaveBeenCalledWith('video', { prompt: '' });
    });
  });

  describe('handleViewPrompt', () => {
    it('shows a prompt modal for minimax source', async () => {
      const asset = { source: 'minimax', slug: 'luxury-perfume-commercial', title: 'Luxury perfume commercial' };
      await handleViewPrompt(asset);
      const modal = document.body.querySelector('div');
      expect(modal).toBeTruthy();
      const titleEl = modal?.querySelector('h3');
      expect(titleEl?.textContent).toBe('Luxury perfume commercial');
      const promptEl = modal?.querySelector('p');
      expect(promptEl?.textContent).toBe('Mocked prompt for luxury-perfume-commercial');
    });

    it('navigates to academy page for academy source', async () => {
      const { navigate } = await import('../lib/router.js');
      const asset = { source: 'academy', id: 'gripmount-ad2-problem-first' };
      await handleViewPrompt(asset);
      expect(navigate).toHaveBeenCalledWith('academy', { template: 'gripmount-ad2-problem-first' });
    });
  });
});

describe('minimaxTemplates', () => {
  it('getAllMinimaxTemplates returns the mapped templates array', () => {
    const all = getAllMinimaxTemplates();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });

  it('getMinimaxTemplateById returns a template by id', () => {
    const all = getAllMinimaxTemplates();
    const first = all[0];
    const found = getMinimaxTemplateById(first.id);
    expect(found).toBeDefined();
    expect(found.id).toBe(first.id);
  });

  it('getMinimaxTemplateById returns undefined for unknown id', () => {
    const found = getMinimaxTemplateById('does-not-exist');
    expect(found).toBeUndefined();
  });

  it('templates include expected fields', () => {
    const all = getAllMinimaxTemplates();
    const t = all[0];
    expect(t).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      model: expect.any(String),
      category: expect.any(String),
      tags: expect.any(Array),
    });
  });
});

describe('academyStudioAdapters', () => {
  it('getAcademyCreateTarget returns route and params for a valid adapter', () => {
    const result = getAcademyCreateTarget('gripmount-ad2-problem-first');
    expect(result).toBeDefined();
    expect(result.route).toBe('commercial');
    expect(result.params.prompt).toBe('UGC commercial ad opening');
    expect(result.params.style).toBe('UGC');
    expect(result.params.aspect_ratio).toBe('9:16');
    expect(result.params.duration).toBe(15);
    expect(result.params['academy-template']).toBe('gripmount-ad2-problem-first');
  });

  it('getAcademyCreateTarget returns null for unknown id', () => {
    const result = getAcademyCreateTarget('unknown-asset-id');
    expect(result).toBeNull();
  });

  it('getAcademyAssetsForStudio returns assets for a studio', () => {
    const assets = getAcademyAssetsForStudio('commercial');
    expect(Array.isArray(assets)).toBe(true);
    expect(assets.length).toBeGreaterThan(0);
    assets.forEach((a) => expect(a.studio).toBe('commercial'));
  });

  it('getAcademyAssetsForStudio returns empty array for unknown studio', () => {
    const assets = getAcademyAssetsForStudio('nonexistent-studio');
    expect(Array.isArray(assets)).toBe(true);
    expect(assets.length).toBe(0);
  });
});

describe('exampleGalleryAssets', () => {
  it('getAllExampleAssets returns a combined array', () => {
    const all = getAllExampleAssets();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
    const sources = new Set(all.map((a) => a.source));
    expect(sources.has('minimax')).toBe(true);
    expect(sources.has('academy')).toBe(true);
  });

  it('getAssetById returns an asset by id', () => {
    const all = getAllExampleAssets();
    const first = all[0];
    const found = getAssetById(first.id);
    expect(found).toBeDefined();
    expect(found.id).toBe(first.id);
  });

  it('getAssetById returns undefined for unknown id', () => {
    const found = getAssetById('does-not-exist');
    expect(found).toBeUndefined();
  });

  it('getAssetsForStudio filters by studio id', () => {
    const videoAssets = getAssetsForStudio('video');
    expect(Array.isArray(videoAssets)).toBe(true);
    videoAssets.forEach((a) => expect(a.studio).toBe('video'));
  });
});

describe('ExampleGallery', () => {
  it('returns a section wrapper with header and empty state when no assets match', () => {
    const el = ExampleGallery({ studioId: 'nonexistent', assets: [] });
    expect(el).toBeTruthy();
    expect(el.tagName).toBe('SECTION');
    expect(el.classList.contains('eg-section')).toBe(true);
    const title = el.querySelector('.eg-title');
    expect(title?.textContent).toBe('Example Gallery');
    const empty = el.querySelector('.eg-empty');
    expect(empty).toBeTruthy();
    expect(empty?.textContent).toContain('No examples yet');
  });

  it('renders cards up to maxCards in a grid', () => {
    const assets = [
      { studio: 'video', title: 'A', posterSrc: '/a.webp', category: 'Social', tags: ['social'] },
      { studio: 'video', title: 'B', posterSrc: '/b.webp', category: 'UGC', tags: ['ugc'] },
      { studio: 'video', title: 'C', posterSrc: '/c.webp', category: 'Cinema', tags: ['cinema'] },
    ];
    const el = ExampleGallery({ studioId: 'video', assets, maxCards: 2 });
    expect(el).toBeTruthy();
    const cards = el.querySelectorAll('.eg-card');
    expect(cards.length).toBe(2);
  });

  it('applies studio filter (studio or studioId)', () => {
    const assets = [
      { studio: 'video', title: 'A', posterSrc: '/a.webp', category: 'Social', tags: ['social'] },
      { studioId: 'cinema', title: 'B', posterSrc: '/b.webp', category: 'Cinema', tags: ['cinema'] },
    ];
    const el = ExampleGallery({ studioId: 'cinema', assets });
    const cards = el.querySelectorAll('.eg-card');
    expect(cards.length).toBe(1);
  });

  it('renders action buttons on each card', () => {
    const assets = [
      { studio: 'video', title: 'A', posterSrc: '/a.webp', category: 'Social', tags: ['social'] },
    ];
    const el = ExampleGallery({ studioId: 'video', assets });
    const viewBtn = el.querySelector('.eg-btn-view');
    expect(viewBtn).toBeTruthy();
    expect(viewBtn.textContent).toBe('View Prompt');
    const createBtn = el.querySelector('.eg-btn-create');
    expect(createBtn).toBeTruthy();
    expect(createBtn.textContent).toBe('Create This Style');
  });

  it('includes a count badge in the header', () => {
    const assets = [
      { studio: 'video', title: 'A', posterSrc: '/a.webp', category: 'Social', tags: ['social'] },
    ];
    const el = ExampleGallery({ studioId: 'video', assets });
    const count = el.querySelector('.eg-count');
    expect(count).toBeTruthy();
    expect(count.textContent).toBe('1 example');
  });

  it('renders filter chips for unique tags', () => {
    const assets = [
      { studio: 'video', title: 'A', posterSrc: '/a.webp', category: 'Social', tags: ['ugc', 'social'] },
      { studio: 'video', title: 'B', posterSrc: '/b.webp', category: 'Cinema', tags: ['cinema', 'ugc'] },
    ];
    const el = ExampleGallery({ studioId: 'video', assets });
    const chips = el.querySelectorAll('.eg-filter-chip');
    expect(chips.length).toBeGreaterThan(1);
    const labels = Array.from(chips).map((c) => c.textContent);
    expect(labels).toContain('All');
  });

  it('filters cards when a tag chip is clicked', () => {
    const assets = [
      { studio: 'video', title: 'A', posterSrc: '/a.webp', category: 'Social', tags: ['ugc', 'social'] },
      { studio: 'video', title: 'B', posterSrc: '/b.webp', category: 'Cinema', tags: ['cinema', 'ugc'] },
    ];
    const el = ExampleGallery({ studioId: 'video', assets });
    const ugcChip = Array.from(el.querySelectorAll('.eg-filter-chip')).find((c) => c.textContent === 'ugc');
    expect(ugcChip).toBeTruthy();
    ugcChip.click();
    const cards = el.querySelectorAll('.eg-card');
    expect(cards.length).toBe(2);
  });

  it('renders tags on each card', () => {
    const assets = [
      { studio: 'video', title: 'A', posterSrc: '/a.webp', category: 'Social', tags: ['ugc', 'social'] },
    ];
    const el = ExampleGallery({ studioId: 'video', assets });
    const tagEls = el.querySelectorAll('.eg-tag');
    expect(tagEls.length).toBeGreaterThan(0);
  });
});
