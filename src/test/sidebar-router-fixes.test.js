import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// The side menu is the app's only studio menu; its list lives in
// src/lib/studioRoutes.js (NAV_GROUPS) and Sidebar.js renders from it.
const navIds = async () => {
  const { NAV_GROUPS } = await import('../lib/studioRoutes.js');
  return NAV_GROUPS.flatMap((g) => g.items.map((it) => it.id));
};

describe('Sidebar fixes', () => {
  it('renders its items from the shared NAV_GROUPS list', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/components/Sidebar.js', 'utf-8');
    expect(content).toContain('NAV_GROUPS');
    expect(content).not.toMatch(/id:\s*'image'/);
  });

  describe('duplicate ai-vfx entry', () => {
    it('should not have duplicate ai-vfx sidebar entries', async () => {
      const ids = await navIds();
      expect(ids.filter((id) => id === 'ai-vfx')).toHaveLength(1);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it('should not have dead commits entry', async () => {
    expect(await navIds()).not.toContain('commits');
  });

  it('should not list retired studios (Training, Chat, Assist, Stock Media, Community)', async () => {
    const ids = await navIds();
    for (const id of ['training', 'chat', 'assist', 'pexels-media', 'community']) {
      expect(ids).not.toContain(id);
    }
    const fs = await import('node:fs');
    expect(fs.readFileSync('src/components/Sidebar.js', 'utf-8')).not.toContain('browseStockMedia');
  });

  it('should redirect retired routes instead of loading them', async () => {
    const mod = await import('../lib/router.js');
    expect(Object.keys(mod.RETIRED_ROUTES).sort()).toEqual(['assist', 'chat', 'community', 'pexels-media', 'training']);
  });

  it('should map brand sub-routes to brand for active state', async () => {
    const { getNavItemForRoute } = await import('../lib/studioRoutes.js');
    for (const page of ['brand-dna', 'campaign', 'campaign-page', 'asset-edit', 'photo-studio', 'brand-photo-studio']) {
      expect(getNavItemForRoute(page)).toBe('brand');
    }
  });

  it('highlights the right entry for aliases and template pages', async () => {
    const { getNavItemForRoute } = await import('../lib/studioRoutes.js');
    expect(getNavItemForRoute('image')).toBe('image');
    expect(getNavItemForRoute('cinegen')).toBe('workbench');
    expect(getNavItemForRoute('video-agent-studio')).toBe('video-agent');
    expect(getNavItemForRoute('zackd')).toBe('zackd');
    expect(getNavItemForRoute('zackd-studio')).toBe('zackd');
    expect(getNavItemForRoute('template/anime-converter')).toBe('templates');
    expect(getNavItemForRoute('settings')).toBeNull();
  });

  it('should not have separate brand-dna, brand-photo-studio navItems', async () => {
    const ids = await navIds();
    expect(ids).not.toContain('brand-dna');
    expect(ids).not.toContain('brand-photo-studio');
    expect(ids).not.toContain('asset-edit');
  });
});

describe('Router fixes', () => {
  it('should register content-library page loader', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/lib/router.js', 'utf-8');
    expect(content).toContain("'content-library': () => import('../components/ContentLibraryPage.js')");
    expect(content).toContain('m => m.ContentLibraryPage()');
  });

  it('should route brand to BrandStudio, not BrandStudioIframe', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/lib/router.js', 'utf-8');
    expect(content).toContain("brand: () => import('../components/BrandStudio.js')");
    expect(content).not.toContain("BrandStudioIframe");
  });

  it('should have cinema-template page loader', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/lib/router.js', 'utf-8');
    expect(content).toContain("'cinema-template': () => import('../components/CinemaTemplateStudio.js')");
  });

  it('should export getRouteForItem and cleanTemplateParams', async () => {
    const mod = await import('../lib/router.js');
    expect(typeof mod.getRouteForItem).toBe('function');
    expect(typeof mod.cleanTemplateParams).toBe('function');
  });
});

describe('Model picker upgrade', () => {
  it('modelSelectorUI should export refresh function', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/lib/modelSelectorUI.js', 'utf-8');
    // Check refresh is returned from mountTemplateModelSelector
    const returnSection = content.substring(content.indexOf('return {'), content.indexOf('panel,'));
    expect(returnSection).toContain('refresh');
  });

  it('ImageStudio should use the upstream ModelDropdown picker', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/components/ImageStudio.js', 'utf-8');
    expect(content).toContain('mountUpstreamModelPicker');
    expect(content).not.toContain('mountModelSelector(');
  });

  it('VideoStudio should use the upstream ModelDropdown picker', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/components/VideoStudio.js', 'utf-8');
    expect(content).toContain('mountUpstreamModelPicker');
    expect(content).not.toContain('mountModelSelector(');
  });

  it('CinemaStudio should import mountVideoModelSelector', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/components/CinemaStudio.js', 'utf-8');
    expect(content).toContain('mountVideoModelSelector');
    expect(content).not.toContain('mountModelSelector(');
  });
});

describe('Thumbnail fixes', () => {
  it('should reference corrected thumbnail paths', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/lib/thumbnails.js', 'utf-8');
    expect(content).toContain("videoagent.webp.png");
    expect(content).toContain("pages/templates.webp.png");
  });

  it('should have thumbnail files in public directory', async () => {
    const fs = await import('node:fs');
    const files = fs.readdirSync('public/thumbnails/heroes').filter(f => f.startsWith('videoagent'));
    expect(files.length).toBeGreaterThan(0);
  });
});
