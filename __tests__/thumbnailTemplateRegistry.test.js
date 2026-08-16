import { describe, it, expect, vi } from 'vitest';
import {
  getTemplateById,
  getAllTemplates,
  getTemplatesByCategory,
  getTemplatesByPlatform,
  getTemplatesByAspectRatio,
  searchTemplates,
  getTemplateCategories,
  validateRegistryTemplate,
  validateTemplateFieldValues,
} from '../src/lib/thumbnailTemplateRegistry.js';
import { ValidationError } from '../src/lib/thumbnailTemplateValidation.js';

describe('thumbnailTemplateRegistry', () => {
  const ALL_TEMPLATES = getAllTemplates();

  describe('getTemplateById', () => {
    it('returns the correct template for a known registry key', () => {
      const t = getTemplateById('boldHeadline');
      expect(t).toBeDefined();
      expect(t.id).toBe('bold-headline');
      expect(t.name).toBe('Bold Headline');
    });

    it('returns undefined for an unknown registry key', () => {
      expect(getTemplateById('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllTemplates', () => {
    it('returns an array of all templates', () => {
      const all = getAllTemplates();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThan(0);
    });

    it('returns every template defined in THUMBNAIL_TEMPLATES', () => {
      expect(getAllTemplates().length).toBeGreaterThanOrEqual(20);
    });
  });

  describe('getTemplatesByCategory', () => {
    it('filters templates by exact category match', () => {
      const marketing = getTemplatesByCategory('Marketing/Social');
      expect(Array.isArray(marketing)).toBe(true);
      marketing.forEach(t => expect(t.category).toBe('Marketing/Social'));
    });

    it('returns empty array for unknown category', () => {
      expect(getTemplatesByCategory('Unknown/Category')).toEqual([]);
    });

    it('returns templates for Creator/Person category', () => {
      const creator = getTemplatesByCategory('Creator/Person');
      expect(creator.length).toBeGreaterThan(0);
      creator.forEach(t => expect(t.category).toBe('Creator/Person'));
    });
  });

  describe('getTemplatesByPlatform', () => {
    it('filters templates that support youtube', () => {
      const yt = getTemplatesByPlatform('youtube');
      expect(yt.length).toBeGreaterThan(0);
      yt.forEach(t => expect(t.supportedPlatforms).toContain('youtube'));
    });

    it('returns empty array for unknown platform', () => {
      expect(getTemplatesByPlatform('nonexistent-platform')).toEqual([]);
    });

    it('filters templates for tiktok', () => {
      const tk = getTemplatesByPlatform('tiktok');
      expect(tk.length).toBeGreaterThan(0);
      tk.forEach(t => expect(t.supportedPlatforms).toContain('tiktok'));
    });
  });

  describe('getTemplatesByAspectRatio', () => {
    it('filters templates supporting 16:9', () => {
      const r = getTemplatesByAspectRatio('16:9');
      expect(r.length).toBeGreaterThan(0);
      r.forEach(t => expect(t.supportedAspectRatios).toContain('16:9'));
    });

    it('filters templates supporting 9:16', () => {
      const r = getTemplatesByAspectRatio('9:16');
      expect(r.length).toBeGreaterThan(0);
      r.forEach(t => expect(t.supportedAspectRatios).toContain('9:16'));
    });

    it('returns empty array for invalid ratio', () => {
      expect(getTemplatesByAspectRatio('99:99')).toEqual([]);
    });
  });

  describe('searchTemplates', () => {
    it('matches by id', () => {
      const results = searchTemplates('bold-headline');
      expect(results.some(t => t.id === 'bold-headline')).toBe(true);
    });

    it('matches by name', () => {
      const results = searchTemplates('Bold Headline');
      expect(results.some(t => t.name === 'Bold Headline')).toBe(true);
    });

    it('matches by category', () => {
      const results = searchTemplates('Marketing/Social');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(t => expect(t.category).toContain('Marketing'));
    });

    it('matches by tags', () => {
      const results = searchTemplates('tiktok');
      expect(results.length).toBeGreaterThan(0);
    });

    it('matches by description', () => {
      const results = searchTemplates('broadcast');
      expect(results.some(t => t.description.toLowerCase().includes('broadcast'))).toBe(true);
    });

    it('returns all templates for empty query', () => {
      expect(searchTemplates('')).toHaveLength(getAllTemplates().length);
    });

    it('returns all templates for whitespace-only query', () => {
      expect(searchTemplates('   ')).toHaveLength(getAllTemplates().length);
    });
  });

  describe('getTemplateCategories', () => {
    it('returns a sorted array of unique categories', () => {
      const cats = getTemplateCategories();
      expect(Array.isArray(cats)).toBe(true);
      expect(cats.length).toBeGreaterThan(0);
      const sorted = [...cats].sort();
      expect(cats).toEqual(sorted);
    });

    it('contains expected category names', () => {
      const cats = getTemplateCategories();
      expect(cats).toContain('Marketing/Social');
      expect(cats).toContain('Creator/Person');
      expect(cats).toContain('Information/Education');
    });

    it('has no duplicates', () => {
      const cats = getTemplateCategories();
      expect(new Set(cats).size).toBe(cats.length);
    });
  });

  describe('validateRegistryTemplate', () => {
    it('passes for a valid template', () => {
      const valid = ALL_TEMPLATES[0];
      expect(() => validateRegistryTemplate(valid)).not.toThrow();
    });

    it('throws for a template missing required id', () => {
      expect(() => validateRegistryTemplate({})).toThrow(ValidationError);
    });

    it('throws for a template with invalid referenceType', () => {
      const bad = { ...ALL_TEMPLATES[0], referenceType: 'invalid' };
      expect(() => validateRegistryTemplate(bad)).toThrow(ValidationError);
    });

    it('throws for a template with version != 1', () => {
      const bad = { ...ALL_TEMPLATES[0], version: 2 };
      expect(() => validateRegistryTemplate(bad)).toThrow(ValidationError);
    });

    it('throws for a template with empty tags', () => {
      const bad = { ...ALL_TEMPLATES[0], tags: [] };
      expect(() => validateRegistryTemplate(bad)).toThrow(ValidationError);
    });
  });

  describe('validateTemplateFieldValues', () => {
    it('catches missing required fields', () => {
      const tpl = getTemplateById('boldHeadline');
      const errors = validateTemplateFieldValues(tpl, {});
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.toLowerCase().includes('required'))).toBe(true);
    });

    it('passes for valid field values', () => {
      const tpl = getTemplateById('boldHeadline');
      const errors = validateTemplateFieldValues(tpl, {
        headline: 'Test Headline',
        tone: 'bold',
      });
      expect(errors).toEqual([]);
    });

    it('catches invalid select values', () => {
      const tpl = getTemplateById('boldHeadline');
      const errors = validateTemplateFieldValues(tpl, {
        headline: 'Test',
        tone: 'invalid-tone',
      });
      expect(errors.some(e => e.includes('invalid selection'))).toBe(true);
    });
  });

  describe('registry integrity', () => {
    it('all template ids are unique', () => {
      const ids = ALL_TEMPLATES.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all required fields exist in each template', () => {
      const requiredKeys = [
        'id', 'name', 'category', 'tags', 'description',
        'requiresReference', 'referenceRequired', 'referenceType',
        'minReferences', 'maxReferences', 'supportedAspectRatios',
        'supportedPlatforms', 'textMode', 'fields', 'promptRecipe',
        'generationDefaults', 'version',
      ];
      ALL_TEMPLATES.forEach(t => {
        requiredKeys.forEach(key => {
          expect(t).toHaveProperty(key);
        });
      });
    });

    it('reference-required templates are configured correctly', () => {
      const refRequired = ALL_TEMPLATES.filter(t => t.requiresReference);
      refRequired.forEach(t => {
        expect(t.minReferences).toBeGreaterThanOrEqual(0);
        expect(t.maxReferences).toBeGreaterThanOrEqual(t.minReferences);
        expect(t.referenceType).not.toBe('none');
      });
    });

    it('supported ratios are valid aspect ratio strings', () => {
      const ratioRegex = /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/;
      ALL_TEMPLATES.forEach(t => {
        t.supportedAspectRatios.forEach(r => {
          expect(ratioRegex.test(r)).toBe(true);
        });
      });
    });

    it('template categories are valid non-empty strings', () => {
      ALL_TEMPLATES.forEach(t => {
        expect(typeof t.category).toBe('string');
        expect(t.category.length).toBeGreaterThan(0);
      });
    });

    it('preview/fallback handling: templates have previewUrl or fallback', () => {
      ALL_TEMPLATES.forEach(t => {
        expect(typeof t.previewUrl).toBe('string');
      });
    });
  });
});
