// Track 10 — AI Headshots & Portraits recipes.
// Each recipe is consumed by executeRecipe() and routes to a SmartVideo studio.

export const RECIPES_10 = {
  '10-ai-headshots-and-portraits::headshot-prompt-library': {
    id: '10-ai-headshots-and-portraits::headshot-prompt-library',
    title: 'Headshot Prompt Library',
    description: 'Generate tailored corporate & creative headshots across 15 roles using the prompt cheat-sheet.',
    category: '10-ai-headshots-and-portraits',
    target: 'image',
    icon: 'User',
    buildPrompt(ctx = {}) {
      const subject = (ctx.subject || '[Identity Anchor]').toString().trim();
      return [
        'AI Corporate & Creative Headshot Prompt Library',
        `Subject identity anchor: ${subject}`,
        '',
        'Generate a photorealistic studio headshot using one of these role-specific prompt anchors:',
        '',
        '1. CEO / C-Suite:',
        '   "Photorealistic 8k corporate executive portrait photograph, commanding confident smile, dark navy tailored suit blazer and crisp white shirt, soft Rembrandt lighting, dark charcoal gradient background, 85mm lens, f/2.8, highly detailed skin pores."',
        '',
        '2. Tech Founder / CEO:',
        '   "Photorealistic 8k tech founder headshot, confident energetic smile, dark grey fitted turtleneck, soft studio lighting, subtle warm background glow, 85mm f/1.8 lens."',
        '',
        '3. Creative Director / Agency Principal:',
        '   "Photorealistic 8k editorial portrait, sophisticated aesthetic, structured dark coat, soft natural window light, architectural urban brick background, shallow depth of field."',
        '',
        '4. Keynote Speaker / Author:',
        '   "Photorealistic 8k dramatic editorial portrait, thoughtful intense expression, dark moody studio background, dramatic Rembrandt side lighting, warm rim light, NYT book cover style."',
        '',
        'Replace [Identity Anchor] with the subject; keep 85mm portrait lens, photorealistic skin texture, and a neutral or branded background. Maintain subject consistency across all variants.',
      ].join('\n');
    },
  },

  '10-ai-headshots-and-portraits::headshot-style-guide': {
    id: '10-ai-headshots-and-portraits::headshot-style-guide',
    title: 'Headshot Style & Lighting Guide',
    description: 'Apply consistent studio lighting, executive wardrobe, and negative prompts for corporate portraits.',
    category: '10-ai-headshots-and-portraits',
    target: 'image',
    icon: 'Sparkles',
    buildPrompt(ctx = {}) {
      const style = (ctx.style || 'Corporate Rembrandt (Executive Default)').toString().trim();
      return [
        'AI Corporate Headshot Style & Lighting Guide',
        `Selected lighting setup: ${style}`,
        '',
        'Lighting setup styles:',
        '',
        '1. Corporate Rembrandt (Executive Default):',
        '   "Studio portrait photograph, soft Rembrandt key light, subtle shadow side fill, soft backlight rim separating shoulders, neutral dark grey gradient studio background, 85mm portrait lens, f/2.8 depth of field."',
        '',
        '2. Modern Tech / Soft Butterfly:',
        '   "Studio portrait photograph, high softbox butterfly lighting, soft warm fill light, friendly approachable smile, bright modern glass office background with soft bokeh, 85mm lens, photorealistic skin texture."',
        '',
        '3. Creative Editorial / High Key:',
        '   "Editorial studio portrait, bright high key lighting, crisp white studio background, vibrant soft lighting, sharp focus on eyes, clean modern aesthetic, 85mm lens."',
        '',
        'Executive wardrobe descriptors: Formal Executive (tailored charcoal navy suit blazer, crisp white dress shirt, silk tie) | Business Casual (dark navy blazer, open-collar light blue shirt, no tie) | Tech Founder (sleek dark grey fitted turtleneck) | Creative Professional (structured black blazer, plain white crewneck t-shirt).',
        '',
        'Always append this negative prompt:',
        'plastic skin, mannequin face, over-smoothed skin, extra teeth, asymmetric eyes, cartoon, 3d render look, oversaturated, harsh direct flash, warped neck, deformed ears, low resolution, blurry, bad anatomy, double chin distortion, glossy forehead',
      ].join('\n');
    },
  },
};
