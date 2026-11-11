import { describe, expect, it } from 'vitest';
import { MOTION_TEMPLATES } from '../../../data/motionRecipeCatalog';
import { PRODUCT_TEXTURE_SHOTS, drawsSampleScreen, isProductTextureShot } from '../lib/productShots';
import { textureOverrides } from '../demosrc/_fixtures/liveTexture';

describe("recipes that show the site's own screens", () => {
  it('lists recipes that exist in the catalog', () => {
    for (const name of PRODUCT_TEXTURE_SHOTS) expect(MOTION_TEMPLATES.some((t) => t.componentName === name), name).toBe(true);
  });

  it('counts the dashboard / card fixture recipes and the card recipes as real-page shots (no sample-screen flag)', () => {
    for (const name of ['AnimeImpact', 'BentoLightUp', 'BeforeAfterSliderScrub', 'CardStack', 'Carousel3D', 'UiStripAwayOutro', 'ProductCardProgressiveAssemble', 'NeonFrameForerun', 'NeonFrameForerunOrbit']) {
      const t = MOTION_TEMPLATES.find((x) => x.componentName === name)!;
      expect(isProductTextureShot(name), name).toBe(true);
      expect(drawsSampleScreen(t), name).toBe(false);
    }
  });

  it("fills the page and crop slots the fixtures read from a clip's captures", () => {
    const o = textureOverrides(['https://x/p1.png', 'https://x/p2.png'], ['https://x/c1.png']);
    expect(o['projects-full.png']).toBe('https://x/p1.png');
    expect(o['detail-full.png']).toBe('https://x/p2.png');
    expect(o['card4.png']).toBe('https://x/c1.png');
    expect(textureOverrides([], [])['projects-full.png']).toBeUndefined();
  });
});
