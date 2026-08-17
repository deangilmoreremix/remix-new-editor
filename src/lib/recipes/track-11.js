// Track 11 — AI Print-on-Demand & Merch recipes.
// Each recipe is consumed by executeRecipe() and routes to a SmartVideo studio.

export const RECIPES_11 = {
  '11-ai-print-on-demand-and-merch::merch-prompt-brief': {
    id: '11-ai-print-on-demand-and-merch::merch-prompt-brief',
    title: 'Merch Prompt Brief',
    description: 'Build apparel-optimized vector art prompts with print specs and 300 DPI scaling.',
    category: '11-ai-print-on-demand-and-merch',
    target: 'image',
    icon: 'Layers',
    buildPrompt(ctx = {}) {
      const subject = (ctx.subject || '[SUBJECT]').toString().trim();
      return [
        'AI Print-on-Demand Vector Brief & Style Guide',
        `Subject: ${subject}`,
        '',
        'Vector style prompt frameworks:',
        '',
        '1. Cyberpunk Neon Vector (Apparel & Posters):',
        '   "Clean vector t-shirt graphic of [SUBJECT], Japanese typography accents, bold black outlines, vibrant synthwave neon teal and magenta colors, high contrast, isolated on solid black background, 300 DPI apparel graphic."',
        '',
        '2. Retro 70s Badge / Outdoor Vintage:',
        '   "Retro 70s vintage badge t-shirt graphic of [SUBJECT], sunburst rays in background, distressed muted earth tones, vintage typography, clean vector illustration, isolated on white background, 300 DPI."',
        '',
        '3. Cottagecore Botanical Watercolor:',
        '   "Vintage botanical watercolor illustration of [SUBJECT], detailed floral accents, elegant linework, soft natural colors, clean background, 300 DPI graphic."',
        '',
        'Print specifications checklist:',
        '• Canvas Resolution: scaled to at least 4500 × 5400 px @ 300 DPI (standard DTG chest print).',
        '• Transparency: background fully removed, saved as 32-bit transparent PNG-24.',
        '• Color Mode: RGB for DTG digital printing.',
        '• Linework Sharpness: edges upscaled via vector interpolation to avoid pixelation on dark fabrics.',
        '• Trademark Search: verify keywords on USPTO TESS to ensure zero trademark conflicts.',
      ].join('\n');
    },
  },

  '11-ai-print-on-demand-and-merch::niche-prompt-matrix': {
    id: '11-ai-print-on-demand-and-merch::niche-prompt-matrix',
    title: 'Niche Prompt Matrix',
    description: 'Generate distinct, high-converting merch graphics across 8 proven POD niches.',
    category: '11-ai-print-on-demand-and-merch',
    target: 'image',
    icon: 'Grid',
    buildPrompt(ctx = {}) {
      const subject = (ctx.subject || '[SUBJECT]').toString().trim();
      return [
        'AI Print-on-Demand Niche Prompt Matrix',
        `Subject: ${subject}`,
        '',
        'Proven POD niche prompts:',
        '',
        '1. Cyberpunk & Tech Aesthetics:',
        '   "Clean vector t-shirt graphic of [SUBJECT], Japanese kanji accents, bold black outlines, vibrant synthwave neon teal and magenta colors, high contrast, isolated on solid black background, 300 DPI apparel graphic."',
        '',
        '2. Retro 70s Badge & Camping:',
        '   "Retro 70s vintage badge t-shirt graphic of [SUBJECT], sunburst rays, distressed muted earth tones, vintage typography, clean vector illustration, isolated on white background, 300 DPI."',
        '',
        '3. Cottagecore Botanical Wildflowers:',
        '   "Vintage botanical watercolor illustration of [SUBJECT], detailed floral accents, elegant linework, soft natural muted colors, clean isolated background, 300 DPI graphic."',
        '',
        '4. Minimalist One-Line Art:',
        '   "Continuous one-line vector art of [SUBJECT], minimalist clean graphic, elegant black linework, subtle beige watercolor blob background, isolated, 300 DPI graphic."',
        '',
        '5. Funny Niche Humor / Quotes:',
        '   "Bold typography shirt graphic featuring text \'[QUOTE]\', surrounded by minimalist retro vector icon of [SUBJECT], vintage color palette, clean apparel design, 300 DPI."',
        '',
        '6. Japanese Sumi-e & Dragon Art:',
        '   "Traditional Japanese Sumi-e ink wash vector illustration of [SUBJECT], bold brush strokes, subtle red sun background, high contrast, clean vector apparel print, 300 DPI."',
        '',
        '7. Retro Space & Astronauts:',
        '   "Vintage 80s synthwave vector illustration of an astronaut floating in deep space, neon grid moon background, bold lines, 300 DPI apparel design."',
        '',
        '8. Pet Lover Custom Art:',
        '   "Charming vector illustration of a regal [DOG_BREED] wearing a tiny crown, warm painterly portrait style, clean isolated background, 300 DPI graphic."',
      ].join('\n');
    },
  },
};
