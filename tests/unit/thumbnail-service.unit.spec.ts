import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

let storage: Record<string, string>;
let mockLocalStorage: any;

beforeEach(() => {
  vi.resetModules();
  storage = {};
  mockLocalStorage = {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
    removeItem: vi.fn((key: string) => { delete storage[key]; }),
    clear: vi.fn(() => { Object.keys(storage).forEach((k) => delete storage[k]); }),
  };
  vi.stubGlobal('localStorage', mockLocalStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('thumbnail service', () => {
  describe('createHeroSection', () => {
    it('returns a DOM element with correct structure for a valid studio', async () => {
      const { createHeroSection } = await import('../../src/lib/thumbnails.js');
      const result = createHeroSection('video', 'my-class');

      expect(result).not.toBeNull();
      expect(result.tagName).toBe('DIV');
      expect(result.className).toContain('hero-banner');
      expect(result.className).toContain('my-class');
      expect(result.children.length).toBe(3);
      expect(result.children[0].className).toContain('thumb-skeleton');
      expect(result.children[1].tagName).toBe('IMG');
      expect(result.children[2].className).toContain('bg-gradient-to-t');
    });

    it('returns null for an unknown studio id', async () => {
      const { createHeroSection } = await import('../../src/lib/thumbnails.js');
      const result = createHeroSection('nonexistent-studio');
      expect(result).toBeNull();
    });

    it('uses default empty className when none provided', async () => {
      const { createHeroSection } = await import('../../src/lib/thumbnails.js');
      const result = createHeroSection('video');
      expect(result).not.toBeNull();
      expect(result.className).toBe('hero-banner relative w-full overflow-hidden rounded-2xl ');
    });
  });

  describe('custom thumbnail cache', () => {
    it('getCustomThumbnailFromCache returns null when no cache exists', async () => {
      const { getCustomThumbnailFromCache } = await import('../../src/lib/thumbnails.js');
      expect(getCustomThumbnailFromCache('any-key')).toBeNull();
    });

    it('saveCustomThumbnailToCache stores URL in localStorage', async () => {
      const { saveCustomThumbnailToCache } = await import('../../src/lib/thumbnails.js');
      saveCustomThumbnailToCache('my-template', 'https://example.com/thumb.png');

      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
      const [, storedJson] = mockLocalStorage.setItem.mock.calls[0];
      const parsed = JSON.parse(storedJson);
      expect(parsed['my-template']).toBe('https://example.com/thumb.png');
    });

    it('getCustomThumbnailFromCache returns saved URL after save', async () => {
      const { saveCustomThumbnailToCache, getCustomThumbnailFromCache } = await import(
        '../../src/lib/thumbnails.js'
      );
      saveCustomThumbnailToCache('template-1', 'https://example.com/thumb1.png');
      expect(getCustomThumbnailFromCache('template-1')).toBe('https://example.com/thumb1.png');
    });

    it('clearCustomThumbnailCache removes cached URL', async () => {
      const { saveCustomThumbnailToCache, clearCustomThumbnailCache, getCustomThumbnailFromCache } =
        await import('../../src/lib/thumbnails.js');
      saveCustomThumbnailToCache('template-1', 'https://example.com/thumb1.png');
      clearCustomThumbnailCache('template-1');

      expect(getCustomThumbnailFromCache('template-1')).toBeNull();
      const [, storedJson] = mockLocalStorage.setItem.mock.calls[mockLocalStorage.setItem.mock.calls.length - 1];
      const parsed = JSON.parse(storedJson);
      expect(parsed['template-1']).toBeUndefined();
    });

    it('ignores empty template id for save', async () => {
      const { saveCustomThumbnailToCache } = await import('../../src/lib/thumbnails.js');
      saveCustomThumbnailToCache('', 'https://example.com/thumb.png');
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('ignores empty template id for get', async () => {
      const { getCustomThumbnailFromCache } = await import('../../src/lib/thumbnails.js');
      expect(getCustomThumbnailFromCache('')).toBeNull();
    });

    it('ignores empty template id for clear', async () => {
      const { clearCustomThumbnailCache } = await import('../../src/lib/thumbnails.js');
      clearCustomThumbnailCache('');
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('handles cache behavior with multiple keys', async () => {
      const { saveCustomThumbnailToCache, getCustomThumbnailFromCache, clearCustomThumbnailCache } =
        await import('../../src/lib/thumbnails.js');

      saveCustomThumbnailToCache('template-a', 'https://example.com/a.png');
      saveCustomThumbnailToCache('template-b', 'https://example.com/b.png');
      saveCustomThumbnailToCache('template-c', 'https://example.com/c.png');

      expect(getCustomThumbnailFromCache('template-a')).toBe('https://example.com/a.png');
      expect(getCustomThumbnailFromCache('template-b')).toBe('https://example.com/b.png');
      expect(getCustomThumbnailFromCache('template-c')).toBe('https://example.com/c.png');

      clearCustomThumbnailCache('template-b');
      expect(getCustomThumbnailFromCache('template-b')).toBeNull();
      expect(getCustomThumbnailFromCache('template-a')).toBe('https://example.com/a.png');
      expect(getCustomThumbnailFromCache('template-c')).toBe('https://example.com/c.png');
    });

    it('overwrites existing cached URL on second save', async () => {
      const { saveCustomThumbnailToCache, getCustomThumbnailFromCache } = await import(
        '../../src/lib/thumbnails.js'
      );
      saveCustomThumbnailToCache('template-1', 'https://example.com/old.png');
      saveCustomThumbnailToCache('template-1', 'https://example.com/new.png');
      expect(getCustomThumbnailFromCache('template-1')).toBe('https://example.com/new.png');
    });
  });

  describe('getTemplateThumbnailCandidates', () => {
    it('returns an array of candidates for a string template id', async () => {
      const { getTemplateThumbnailCandidates } = await import('../../src/lib/thumbnails.js');
      const candidates = getTemplateThumbnailCandidates('some-template');
      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBeGreaterThan(0);
    });

    it('returns candidates for an object template with niche and category', async () => {
      const { getTemplateThumbnailCandidates } = await import('../../src/lib/thumbnails.js');
      const candidates = getTemplateThumbnailCandidates({
        id: 'my-template',
        niche: 'Restaurant & Cafe',
        category: 'Social Media',
      });
      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates.some((c) => c.includes('Restaurant & Cafe') || c.includes('restaurant'))).toBe(true);
    });

    it('includes placeholder as the last candidate', async () => {
      const { getTemplateThumbnailCandidates } = await import('../../src/lib/thumbnails.js');
      const candidates = getTemplateThumbnailCandidates('unknown-template');
      expect(candidates[candidates.length - 1]).toBe('/thumbnails/pages/placeholder.webp');
    });

    it('deduplicates candidates across successive calls', async () => {
      const { getTemplateThumbnailCandidates, resetThumbnailAssignments } = await import(
        '../../src/lib/thumbnails.js'
      );
      const candidates1 = getTemplateThumbnailCandidates({ id: 't1', niche: 'Restaurant & Cafe' });
      const candidates2 = getTemplateThumbnailCandidates({ id: 't2', niche: 'Restaurant & Cafe' });

      const shared = candidates1.filter((c) => candidates2.includes(c));
      // The direct per-template paths may differ, but niche paths should not overlap
      const nichePaths1 = candidates1.filter((c) => c.includes('restaurant'));
      const nichePaths2 = candidates2.filter((c) => c.includes('restaurant'));
      expect(nichePaths1[0]).not.toBe(nichePaths2[0]);
    });

    it('resets assignments when resetThumbnailAssignments is called', async () => {
      const { getTemplateThumbnailCandidates, resetThumbnailAssignments } = await import(
        '../../src/lib/thumbnails.js'
      );
      getTemplateThumbnailCandidates({ id: 't1', niche: 'Restaurant & Cafe' });
      resetThumbnailAssignments();
      const candidates = getTemplateThumbnailCandidates({ id: 't1', niche: 'Restaurant & Cafe' });
      expect(candidates.length).toBeGreaterThan(0);
    });
  });

  describe('getTemplateThumbnailWithFallback', () => {
    it('returns webp and webp.png paths for a template id', async () => {
      const { getTemplateThumbnailWithFallback } = await import('../../src/lib/thumbnails.js');
      const result = getTemplateThumbnailWithFallback('my-template');
      expect(result.webpPath).toBe('/thumbnails/templates/my-template.webp');
      expect(result.pngPath).toBe('/thumbnails/templates/my-template.webp.png');
    });

    it('normalizes template ids via thumbnailStemForId in getTemplateThumbnailCandidates', async () => {
      const { getTemplateThumbnailCandidates } = await import('../../src/lib/thumbnails.js');
      const candidates = getTemplateThumbnailCandidates('fashion_lifestyle_film');
      expect(candidates.some((c) => c.includes('fashion_lifestyle.webp'))).toBe(true);
    });
  });

  describe('createThumbnailImg', () => {
    it('creates an img element with correct attributes', async () => {
      const { createThumbnailImg } = await import('../../src/lib/thumbnails.js');
      const img = createThumbnailImg('/thumb.png', 'alt text', 'my-class');
      expect(img.tagName).toBe('IMG');
      expect(img.alt).toBe('alt text');
      expect(img.loading).toBe('lazy');
      expect(img.className).toBe('my-class');
      expect(img.getAttribute('src')).toBe('/thumb.png');
    });

    it('uses fallback candidate chain when fallbackTemplate is provided', async () => {
      const { createThumbnailImg } = await import('../../src/lib/thumbnails.js');
      const img = createThumbnailImg('/thumb.png', 'alt', '', { id: 'my-template', niche: 'Restaurant & Cafe' });
      expect(img.src).toBeTruthy();
    });

    it('adds .webp.png fallback for static .webp paths', async () => {
      const { createThumbnailImg } = await import('../../src/lib/thumbnails.js');
      const img = createThumbnailImg('/thumb.webp', 'alt');
      expect(img.getAttribute('src')).toBe('/thumb.webp');
    });

    it('falls back through candidates on error', async () => {
      const { createThumbnailImg } = await import('../../src/lib/thumbnails.js');
      const img = createThumbnailImg('/thumb.webp', 'alt');
      // First error advances to .webp.png fallback
      img.onerror(new Event('error'));
      expect(img.getAttribute('src')).toBe('/thumb.webp.png');
    });

    it('hides image and marks parent when all candidates fail', async () => {
      const { createThumbnailImg } = await import('../../src/lib/thumbnails.js');
      const img = createThumbnailImg('/thumb.webp', 'alt');
      const parent = document.createElement('div');
      parent.appendChild(img);

      // Exhaust both candidates
      img.onerror(new Event('error'));
      img.onerror(new Event('error'));
      expect(img.style.display).toBe('none');
      expect(parent.classList.contains('thumb-fallback')).toBe(true);
    });
  });

  describe('localStorage interactions', () => {
    it('mocks localStorage.getItem on module load', async () => {
      storage['template-custom-thumbnails'] = JSON.stringify({ existing: 'url' });
      const { getCustomThumbnailFromCache } = await import('../../src/lib/thumbnails.js');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('template-custom-thumbnails');
      expect(getCustomThumbnailFromCache('existing')).toBe('url');
    });

    it('persists cache to localStorage after save', async () => {
      const { saveCustomThumbnailToCache } = await import('../../src/lib/thumbnails.js');
      saveCustomThumbnailToCache('t1', 'https://cdn.example.com/t1.webp');
      const lastSetCall = mockLocalStorage.setItem.mock.calls.at(-1);
      expect(lastSetCall[0]).toBe('template-custom-thumbnails');
      const parsed = JSON.parse(lastSetCall[1]);
      expect(parsed['t1']).toBe('https://cdn.example.com/t1.webp');
    });

    it('handles corrupted localStorage data gracefully', async () => {
      storage['template-custom-thumbnails'] = 'not-json';
      const { getCustomThumbnailFromCache } = await import('../../src/lib/thumbnails.js');
      // Should not throw; returns empty map
      expect(getCustomThumbnailFromCache('any')).toBeNull();
    });
  });
});
