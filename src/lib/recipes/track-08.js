// Recipes for track 08: AI Fashion & Virtual Try-On.
// Wired into the "Create With Smart Video" CTA via the template-recipes map.

export const RECIPES_08 = {
  '08-ai-fashion-and-virtual-tryon::tryon-spec-sheet': {
    id: '08-ai-fashion-and-virtual-tryon::tryon-spec-sheet',
    title: 'Virtual Try-On Spec',
    description: 'Generate a virtual try-on image from a garment + model specification sheet.',
    category: '08-ai-fashion-and-virtual-tryon',
    target: 'image',
    icon: 'Shirt',
    buildPrompt(ctx = {}) {
      const garment = (ctx.garment || 'Classic Linen Button-Down Shirt').toString().trim();
      const model = (ctx.model || 'East Asian male model, athletic build, 25-35').toString().trim();
      return [
        `Virtual try-on image — wrap "${garment}" onto a custom model.`,
        '',
        'Garment parameters:',
        '• Source: isolated transparent flat-lay / ghost mannequin photo (preserve material texture, fold lines, color).',
        '• Material/texture: light-woven organic flax linen, off-white/cream #F5F2EB.',
        '• Preserve collar detail (open collar) and original draping/folds.',
        '',
        'Target model:',
        `• ${model}`,
        '• Keep face and skin, replace only the clothing (inpaint mask strategy).',
        '• Draping fitting rate ~0.75 for high similarity to original garment folds.',
        '',
        'Composition: centered full-body studio shot, consistent bounding box across runs, natural soft contact shadow. Deliver with a fit rating 1-10 and fabric texture rating.',
      ].join('\n');
    },
  },

  '08-ai-fashion-and-virtual-tryon::lookbook-moodboard': {
    id: '08-ai-fashion-and-virtual-tryon::lookbook-moodboard',
    title: 'Lookbook Moodboard',
    description: 'Generate an editorial fashion lookbook image from a mood/vibe, lighting, and prompt-token spec.',
    category: '08-ai-fashion-and-virtual-tryon',
    target: 'image',
    icon: 'Image',
    buildPrompt(ctx = {}) {
      const theme = (ctx.theme || 'Nordic Minimalist Autumn').toString().trim();
      return [
        `Fashion editorial lookbook image — theme: "${theme}".`,
        '',
        'Visual vibe & aesthetic archetype:',
        '• Core palette: warm taupe, soft sand, muted olive, slate grey.',
        '• Mood keywords: editorial, quiet luxury, organic, architectural.',
        '',
        'Studio lighting:',
        '• Primary key: large diffused softbox from the left at 45°.',
        '• Fill: white reflector bounce from the right to soften neck shadows.',
        '• Backlight: subtle warm rim to separate shoulders from background.',
        '• Ambient: soft overcast daylight.',
        '',
        'Prompt token matrix:',
        '[Editorial fashion model standing in a relaxed pose] + [wearing a minimalist neutral-toned organic knit sweater] + [diffused side studio softbox lighting, soft neutral shadows] + [shot on medium format Hasselblad 80mm lens, f/4, crisp details, natural skin textures].',
        '',
        'Backdrop: textured plaster screen in warm grey. Keep consistent styling across the full lookbook set.',
      ].join('\n');
    },
  },
};
