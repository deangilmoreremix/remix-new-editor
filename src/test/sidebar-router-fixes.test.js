import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Sidebar fixes', () => {
  describe('duplicate ai-vfx entry', () => {
    it('should not have duplicate ai-vfx sidebar entries', async () => {
      const sidebarSource = await import('../components/Sidebar.js?raw');
      const source = sidebarSource.default || await import('../components/Sidebar.js?raw').then(m => m.default);
      // Count occurrences of id: 'ai-vfx'
      const match = source ? source.match(/id:\s*'ai-vfx'/g) || source.match(/id: "ai-vfx"/g) : null;
      // Fallback: check the file directly
      const fs = await import('node:fs');
      const content = fs.readFileSync('src/components/Sidebar.js', 'utf-8');
      const count = (content.match(/id: 'ai-vfx'/g) || []).length;
      expect(count).toBe(1);
    });
  });

  it('should not have dead commits entry', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/components/Sidebar.js', 'utf-8');
    const hasCommits = content.includes("id: 'commits'");
    expect(hasCommits).toBe(false);
  });

  it('should have browseStockMedia import for pexels-media modal', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/components/Sidebar.js', 'utf-8');
    expect(content).toContain('browseStockMedia');
    expect(content).toContain("pexels-media");
  });

  it('should call browseStockMedia when pexels-media is clicked', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/components/Sidebar.js', 'utf-8');
    expect(content).toContain("if (item.id === 'pexels-media')");
    expect(content).toContain('browseStockMedia().catch(() => {})');
  });

  it('should map brand sub-routes to brand for active state', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/components/Sidebar.js', 'utf-8');
    expect(content).toContain("['brand-dna', 'campaign', 'campaign-page', 'asset-edit', 'photo-studio', 'brand-photo-studio'].includes(page)");
  });

  it('should not have separate brand-dna, brand-photo-studio navItems', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/components/Sidebar.js', 'utf-8');
    expect(content).not.toContain("id: 'brand-dna'");
    expect(content).not.toContain("id: 'brand-photo-studio'");
    expect(content).not.toContain("id: 'asset-edit'");
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

  it('ImageStudio should import mountImageModelSelector', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/components/ImageStudio.js', 'utf-8');
    expect(content).toContain('mountImageModelSelector');
    expect(content).not.toContain('mountModelSelector(');
  });

  it('VideoStudio should import mountVideoModelSelector', async () => {
    const fs = await import('node:fs');
    const content = fs.readFileSync('src/components/VideoStudio.js', 'utf-8');
    expect(content).toContain('mountVideoModelSelector');
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
