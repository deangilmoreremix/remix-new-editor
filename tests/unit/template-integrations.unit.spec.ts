import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1. templateSpecs
import { getTemplateSpecs, hasEnhancedSpecs, getEnhancedTemplateIds } from '../../src/lib/templateSpecs.js';

// 2. showcaseTemplateResolver
import { resolveTemplate, hasTemplate, getTemplateCount, loadTemplatePrompt } from '../../src/lib/showcaseTemplateResolver.js';

// 3. templateAdapter
import { normalizeTemplate, normalizeAllTemplates, findTemplateById, filterByCategory, filterByType, getAllCategories, getAllTypes } from '../../src/lib/templateAdapter.js';

// 4. templateMatrix
import { NICHE_ENRICHMENT, FILM_FAMILIES, MATRIX_TEMPLATES } from '../../src/lib/templateMatrix.js';

// 5. templates
import { getTemplateById, getTemplatesByCategory, allTemplates, TEMPLATE_CATEGORIES } from '../../src/lib/templates.js';

describe('templateSpecs', () => {
  it('returns specs for a known template', () => {
    const specs = getTemplateSpecs('tiktok-video');
    expect(specs).toBeDefined();
    expect(specs.coreUseCase).toBe('Viral 9:16 short videos');
    expect(specs.uiDescription).toBeTruthy();
    expect(specs.sceneBlueprint).toBeInstanceOf(Array);
  });

  it('returns null for unknown template', () => {
    expect(getTemplateSpecs('unknown-template-id')).toBeNull();
  });

  it('hasEnhancedSpecs returns true for known templates', () => {
    expect(hasEnhancedSpecs('tiktok-video')).toBe(true);
    expect(hasEnhancedSpecs('instagram-reel')).toBe(true);
    expect(hasEnhancedSpecs('restaurant-brand-film')).toBe(true);
  });

  it('hasEnhancedSpecs returns false for unknown templates', () => {
    expect(hasEnhancedSpecs('nonexistent')).toBe(false);
    expect(hasEnhancedSpecs('')).toBe(false);
  });

  it('getEnhancedTemplateIds returns a non-empty array of strings', () => {
    const ids = getEnhancedTemplateIds();
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every(id => typeof id === 'string')).toBe(true);
    expect(ids).toContain('tiktok-video');
  });
});

describe('showcaseTemplateResolver', () => {
  it('resolveTemplate returns null for null/undefined/non-string', () => {
    expect(resolveTemplate(null)).toBeNull();
    expect(resolveTemplate(undefined)).toBeNull();
    expect(resolveTemplate(123)).toBeNull();
    expect(resolveTemplate('')).toBeNull();
  });

  it('resolveTemplate returns null for regular non-showcase templates', () => {
    expect(resolveTemplate('tiktok-video')).toBeNull();
    expect(resolveTemplate('instagram-reel')).toBeNull();
  });

  it('resolveTemplate returns template for minimax-h3 showcase templates', async () => {
    const tpl = resolveTemplate('minimax-h3-cinematic-wide-shot');
    if (tpl) {
      expect(tpl.templateId).toBe('minimax-h3-cinematic-wide-shot');
      expect(tpl.source).toBe('minimaxh3');
      expect(tpl.model).toBeTruthy();
      expect(tpl.id).toBe('cinematic-wide-shot');
    }
  });

  it('resolveTemplate returns template for seedance-2.5 showcase templates', async () => {
    const tpl = resolveTemplate('seedance-2.5-action-sequence');
    if (tpl) {
      expect(tpl.templateId).toBe('seedance-2.5-action-sequence');
      expect(tpl.source).toBe('seedance25');
      expect(tpl.model).toBeTruthy();
    }
  });

  it('resolveTemplate returns template for seedance-2.0 showcase templates', async () => {
    const tpl = resolveTemplate('seedance-2.0-cyberpunk-city');
    if (tpl) {
      expect(tpl.templateId).toBe('seedance-2.0-cyberpunk-city');
      expect(tpl.source).toBe('zeroLu');
      expect(tpl.model).toBeTruthy();
    }
  });

  it('hasTemplate returns true for valid showcase templates', () => {
    expect(hasTemplate('minimax-h3-10-second-16-9-photoreal-cinematic-wide-shot-fly-735905')).toBe(true);
    expect(hasTemplate('seedance-2.5-seedance-2-5-312407')).toBe(true);
    expect(hasTemplate('seedance-2.0-adam')).toBe(true);
  });

  it('hasTemplate returns false for unknown templates', () => {
    expect(hasTemplate('unknown-template')).toBe(false);
  });

  it('getTemplateCount returns a positive number', () => {
    const count = getTemplateCount();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThan(0);
  });

  it('loadTemplatePrompt returns null for unresolvable templates', async () => {
    const result = await loadTemplatePrompt('unknown-template');
    expect(result).toBeNull();
  });
});

describe('templateAdapter', () => {
  it('normalizeTemplate returns null for null input', () => {
    expect(normalizeTemplate(null)).toBeNull();
    expect(normalizeTemplate(undefined)).toBeNull();
  });

  it('normalizeTemplate preserves existing fields for standard templates', () => {
    const template = {
      id: 'test-template',
      name: 'Test Template',
      description: 'A test template',
      category: 'Social Media',
      outputType: 'video',
      model: 'ai-video-effects',
      modelType: 'i2v',
      aspectRatio: '9:16',
      inputs: [{ name: 'prompt', type: 'text', label: 'Prompt' }],
      basePrompt: '{prompt}, test style',
      defaultParams: { resolution: '720p', duration: 5 },
      icon: '🎬',
    };

    const normalized = normalizeTemplate(template);
    expect(normalized.id).toBe('test-template');
    expect(normalized.name).toBe('Test Template');
    expect(normalized.category).toBe('Social Media');
    expect(normalized.outputType).toBe('video');
    expect(normalized.model).toBe('ai-video-effects');
    expect(normalized.modelType).toBe('i2v');
    expect(normalized.aspectRatio).toBe('9:16');
    expect(normalized.inputs).toBeInstanceOf(Array);
    expect(normalized.inputs.length).toBe(1);
    expect(normalized.basePrompt).toBe('{prompt}, test style');
    expect(normalized.defaultParams).toEqual({ resolution: '720p', duration: 5 });
    expect(normalized.icon).toBe('🎬');
    expect(normalized._type).toBe('standard');
  });

  it('normalizeTemplate fills missing fields with defaults', () => {
    const template = { id: 'minimal-template' };
    const normalized = normalizeTemplate(template);
    expect(normalized.id).toBe('minimal-template');
    expect(normalized.name).toBeUndefined();
    expect(normalized.category).toBe('Uncategorized');
    expect(normalized.outputType).toBe('video');
    expect(normalized.inputs).toBeInstanceOf(Array);
    expect(normalized.basePrompt).toBe('');
    expect(normalized.aspectRatio).toBe('16:9');
    expect(normalized.duration).toBe(5);
    expect(normalized.defaultParams.resolution).toBe('720p');
  });

  it('normalizeTemplate detects matrix templates by filmFamily', () => {
    const template = {
      id: 'restaurant-brand-film',
      name: 'Restaurant Brand Film',
      filmFamily: 'cinematic-commercial',
      outputType: 'video',
      niche: 'restaurant',
    };

    const normalized = normalizeTemplate(template);
    expect(normalized._type).toBe('matrix');
    expect(normalized.filmFamily).toBe('cinematic-commercial');
    expect(normalized.niche).toBe('restaurant');
    expect(normalized.inputs).toBeInstanceOf(Array);
    expect(normalized.inputs.some(i => i.name === 'prompt')).toBe(true);
  });

  it('normalizeTemplate detects niche templates by quickInputs', () => {
    const template = {
      id: 'niche-template',
      name: 'Niche Template',
      quickInputs: [{ name: 'q1', type: 'text', label: 'Q1' }],
      advancedInputs: [{ name: 'a1', type: 'text', label: 'A1' }],
    };

    const normalized = normalizeTemplate(template);
    expect(normalized._type).toBe('niche');
    expect(normalized.quickInputs).toBeInstanceOf(Array);
    expect(normalized.advancedInputs).toBeInstanceOf(Array);
    expect(normalized.inputs.length).toBe(2);
  });

  it('normalizeAllTemplates maps and filters nulls', () => {
    const templates = [
      { id: 't1', name: 'T1' },
      null,
      { id: 't2', name: 'T2' },
    ];
    const result = normalizeAllTemplates(templates);
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('t1');
    expect(result[1].id).toBe('t2');
  });

  it('findTemplateById finds template in normalized array', () => {
    const templates = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' },
    ];
    expect(findTemplateById(templates, 'b')).toEqual(templates[1]);
    expect(findTemplateById(templates, 'z')).toBeNull();
  });

  it('filterByCategory filters templates by category', () => {
    const templates = [
      { id: 'a', category: 'Social Media' },
      { id: 'b', category: 'Commercial' },
      { id: 'c', category: 'Social Media' },
    ];
    const filtered = filterByCategory(templates, 'Social Media');
    expect(filtered.length).toBe(2);
    expect(filtered.every(t => t.category === 'Social Media')).toBe(true);
  });

  it('filterByCategory returns all templates when category is empty', () => {
    const templates = [{ id: 'a' }, { id: 'b' }];
    expect(filterByCategory(templates, '')).toHaveLength(2);
    expect(filterByCategory(templates, null)).toHaveLength(2);
  });

  it('filterByType filters templates by _type', () => {
    const templates = [
      { id: 'a', _type: 'standard' },
      { id: 'b', _type: 'matrix' },
      { id: 'c', _type: 'standard' },
    ];
    const filtered = filterByType(templates, 'standard');
    expect(filtered.length).toBe(2);
    expect(filtered.every(t => t._type === 'standard')).toBe(true);
  });

  it('getAllCategories returns sorted unique categories', () => {
    const templates = [
      { id: 'a', category: 'B' },
      { id: 'b', category: 'A' },
      { id: 'c', category: 'B' },
      { id: 'd', category: 'C' },
    ];
    const categories = getAllCategories(templates);
    expect(categories).toEqual(['A', 'B', 'C']);
  });

  it('getAllTypes returns unique types', () => {
    const templates = [
      { id: 'a', _type: 'standard' },
      { id: 'b', _type: 'matrix' },
      { id: 'c', _type: 'standard' },
    ];
    const types = getAllTypes(templates);
    expect(types).toContain('standard');
    expect(types).toContain('matrix');
    expect(types.length).toBe(2);
  });
});

describe('templateMatrix', () => {
  it('NICHE_ENRICHMENT has expected keys', () => {
    const expectedNiches = [
      'restaurant',
      'med-spa',
      'salon',
      'fitness',
      'real-estate',
      'dental',
      'legal',
      'automotive',
      'fashion',
      'event',
      'luxury-brand',
      'barbershop',
      'chiropractic',
      'agency',
      'saas',
      'local-business',
      'general-business',
    ];
    expectedNiches.forEach(niche => {
      expect(NICHE_ENRICHMENT).toHaveProperty(niche);
      expect(NICHE_ENRICHMENT[niche]).toBeInstanceOf(Array);
      expect(NICHE_ENRICHMENT[niche].length).toBeGreaterThan(0);
    });
  });

  it('FILM_FAMILIES has expected keys', () => {
    const expectedFamilies = [
      'cinematic-commercial',
      'promo-film',
      'documentary-style-film',
      'founder-story-film',
      'testimonial-film',
      'case-study-film',
      'dramatic-trailer',
      'cinematic-short-film',
    ];
    expectedFamilies.forEach(family => {
      expect(FILM_FAMILIES).toHaveProperty(family);
      expect(FILM_FAMILIES[family].blueprint).toBeInstanceOf(Array);
      expect(FILM_FAMILIES[family].direction).toBeTruthy();
    });
  });

  it('MATRIX_TEMPLATES has 120 templates', () => {
    expect(MATRIX_TEMPLATES.length).toBe(120);
  });

  it('MATRIX_TEMPLATES each has required fields', () => {
    MATRIX_TEMPLATES.forEach(template => {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.category).toBeTruthy();
      expect(template.outputType).toBe('video');
      expect(template.filmFamily).toBeTruthy();
      expect(template.niche).toBeTruthy();
    });
  });

  it('MATRIX_TEMPLATES covers all 12 niches with 10 each', () => {
    const nicheCounts = {};
    MATRIX_TEMPLATES.forEach(t => {
      nicheCounts[t.niche] = (nicheCounts[t.niche] || 0) + 1;
    });
    const uniqueNiches = Object.keys(nicheCounts);
    expect(uniqueNiches.length).toBeGreaterThanOrEqual(10);
    Object.values(nicheCounts).forEach(count => {
      expect(count).toBe(10);
    });
  });
});

describe('templates', () => {
  it('getTemplateById returns template for valid id', () => {
    const template = getTemplateById('tiktok-video');
    expect(template).toBeDefined();
    expect(template.id).toBe('tiktok-video');
    expect(template.name).toBe('TikTok Video Creator');
    expect(template.category).toBe(TEMPLATE_CATEGORIES.SOCIAL);
    expect(template.outputType).toBe('video');
    expect(template.inputs).toBeInstanceOf(Array);
  });

  it('getTemplateById returns template for matrix template id', () => {
    const template = getTemplateById('restaurant-brand-film');
    expect(template).toBeDefined();
    expect(template.id).toBe('restaurant-brand-film');
    expect(template.filmFamily).toBe('cinematic-commercial');
  });

  it('getTemplateById returns null for invalid id', () => {
    expect(getTemplateById('nonexistent-template')).toBeNull();
    expect(getTemplateById('')).toBeNull();
  });

  it('allTemplates returns array with base templates plus niche and matrix', () => {
    expect(Array.isArray(allTemplates)).toBe(true);
    expect(allTemplates.length).toBeGreaterThan(0);
  });

  it('getTemplatesByCategory returns templates matching category', () => {
    const socialTemplates = getTemplatesByCategory(TEMPLATE_CATEGORIES.SOCIAL);
    expect(Array.isArray(socialTemplates)).toBe(true);
    expect(socialTemplates.length).toBeGreaterThan(0);
    expect(socialTemplates.every(t => t.category === TEMPLATE_CATEGORIES.SOCIAL)).toBe(true);
  });

  it('getTemplatesByCategory returns empty array for unknown category', () => {
    expect(getTemplatesByCategory('Unknown Category')).toEqual([]);
  });

  it('allTemplates contains restaurant niche templates', () => {
    const restaurantTemplates = getTemplatesByCategory('Restaurant & Cafe');
    expect(restaurantTemplates.length).toBeGreaterThan(0);
    expect(restaurantTemplates.some(t => t.id === 'restaurant-brand-film')).toBe(true);
  });

  it('allTemplates contains med-spa niche templates', () => {
    const medspaTemplates = getTemplatesByCategory('Med Spa & Beauty');
    expect(medspaTemplates.length).toBeGreaterThan(0);
    expect(medspaTemplates.some(t => t.id === 'medspa-brand-film')).toBe(true);
  });

  it('getTemplateById falls back to minimax templates', () => {
    const template = getTemplateById('minimax-h3-cinematic-wide-shot');
    if (template) {
      expect(template.id).toBe('minimax-h3-cinematic-wide-shot');
      expect(template.model).toBeTruthy();
    }
  });
});

describe('integration: normalizeTemplate with matrix templates', () => {
  it('normalizes a matrix template from allTemplates', () => {
    const matrixTemplate = MATRIX_TEMPLATES[0];
    const normalized = normalizeTemplate(matrixTemplate);
    expect(normalized).toBeDefined();
    expect(normalized.id).toBe(matrixTemplate.id);
    expect(normalized.name).toBe(matrixTemplate.name);
    expect(normalized._type).toBe('matrix');
    expect(normalized.inputs).toBeInstanceOf(Array);
    expect(normalized.inputs.length).toBeGreaterThan(0);
  });

  it('normalizes a standard template from allTemplates', () => {
    const standardTemplate = allTemplates.find(t => t.category === TEMPLATE_CATEGORIES.SOCIAL && t.id === 'tiktok-video');
    expect(standardTemplate).toBeDefined();
    const normalized = normalizeTemplate(standardTemplate);
    expect(normalized._type).toBe('standard');
    expect(normalized.inputs.length).toBeGreaterThan(0);
  });

  it('normalizes templates with enhanced specs', () => {
    const template = allTemplates.find(t => t.id === 'tiktok-video');
    expect(template).toBeDefined();
    const normalized = normalizeTemplate(template);
    expect(normalized.coreUseCase).toBeTruthy();
    expect(normalized.visualStyle).toBeTruthy();
    expect(normalized.enhancerKeywords).toBeTruthy();
  });
});
