// Recipes for track 07 (AI Product Photography). Imported by the recipe registry
// aggregator; each recipe is looked up by id via executeRecipe() from the
// template "Create With Smart Video" CTA.

export const RECIPES_07 = {
  '07-ai-product-photography::photography-brief-template': {
    id: '07-ai-product-photography::photography-brief-template',
    title: 'Product Photography Brief',
    description: 'Lock composition, lighting, and prompt structures to generate studio-quality product photos.',
    category: '07-ai-product-photography',
    target: 'image',
    icon: 'Camera',
    buildPrompt(ctx = {}) {
      const p = ctx.product || 'a high-end cosmetic glass bottle';
      return [
        'Generate a studio-quality product photo of: ' + p.toString().trim(),
        '',
        '1. Product Profile',
        '• Category: Cosmetics / Skincare (adjust as needed).',
        '• Packaging: matte amber glass bottle, black dropper cap.',
        '• Reflective properties: semi-gloss.',
        '',
        '2. Visual Setting & Backdrop Spec',
        '• Theme: minimalist Mediterranean stone ledge.',
        '• Surface: travertine stone base, warm textured stucco background.',
        '• Props: single olive branch casting a soft shadow on the wall. Dry surface, no water.',
        '',
        '3. Lighting & Shadow Matrix',
        '• Primary light: side-lit from top-right.',
        '• Quality: diffused golden hour sunlight.',
        '• Shadows: soft, elongated warm shadows to the left; matte reflection on travertine.',
        '',
        '4. Master prompt',
        'A high-end cosmetic glass bottle on a travertine stone block, against a warm beige stucco wall with a single olive branch silhouette, soft side-lit golden hour sun rays casting elegant shadows, photorealistic, studio lighting, commercial photography, shot on 85mm lens, f/2.8, depth of field.',
        '',
        'Return the image plus the exact prompt used so it can be logged and iterated on a seed.',
      ].join('\n');
    },
  },

  '07-ai-product-photography::batch-catalog-spec': {
    id: '07-ai-product-photography::batch-catalog-spec',
    title: 'Batch Catalog Spec',
    description: 'Organize, track, and scale batch catalog generation for e-commerce with consistent layouts.',
    category: '07-ai-product-photography',
    target: 'image',
    icon: 'LayoutGrid',
    buildPrompt(ctx = {}) {
      const cat = (ctx.catalog || 'an e-commerce skincare catalog').toString().trim();
      return [
        'Generate a consistent batch of product catalog images for: ' + cat,
        '',
        '1. Directory Structure Blueprint',
        '01_raw_assets/ (uploads) → 02_isolated_masks/ (bg removed) → 03_ai_backgrounds/ (generated backdrops) → 04_composite_drafts/ (renders) → 05_final_deliver/ (graded/scaled WebP).',
        '',
        '2. Bounding Box & Aspect Ratio Mapping',
        '• Amazon Hero: square (1:1), product occupies exactly 85% of frame height.',
        '• Shopify / WooCommerce gallery: vertical (4:5), product centered with 10% bottom padding.',
        '',
        '3. Bulk Processing Log (per SKU)',
        '| Product SKU | Raw File Path | Isolated Mask Status | Target Backdrop Prompt ID | Composite Render Status | QC Status | Export Path |',
        'Generate every SKU against a single shared backdrop (e.g., BGD-TRAVERTINE-01) so the set reads as one brand catalog, then export to 05_final_deliver/ as color-graded WebP.',
        '',
        'Output the batch with a consistent layout and a per-SKU QC pass noted.',
      ].join('\n');
    },
  },
};
