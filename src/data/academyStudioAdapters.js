
export const ACADEMY_STUDIO_ADAPTERS = [
  {
    id: 'gripmount-ad2-problem-first',
    studio: 'commercial',
    prompt: 'UGC commercial ad opening with a relatable problem-first hook, handheld camera, authentic consumer setting, natural lighting',
    stylePreset: 'UGC',
    aspectRatio: '9:16',
    duration: 15,
    tags: ['ugc', 'commercial', 'problem-first', 'handheld']
  },
  {
    id: 'gripmount-ad3-pov',
    studio: 'commercial',
    prompt: 'POV-style UGC product demo ad, first-person perspective showing product in use, authentic review style, mobile vertical format',
    stylePreset: 'UGC',
    aspectRatio: '9:16',
    duration: 15,
    tags: ['ugc', 'commercial', 'pov', 'product-demo']
  },
  {
    id: 'gripmount-hook-clip',
    studio: 'commercial',
    prompt: 'High-energy UGC ad hook clip, attention-grabbing opening, fast cut, bold text overlay, stop-scroll vertical video',
    stylePreset: 'UGC',
    aspectRatio: '9:16',
    duration: 8,
    tags: ['ugc', 'commercial', 'hook', 'stop-scroll']
  },
  {
    id: '02-ai-filmmaking::astronaut-clip',
    studio: 'cinema',
    prompt: 'Cinematic astronaut scene with dramatic lighting, slow push-in camera movement, deep space background, film grain, anamorphic lens flare',
    stylePreset: 'Cinematic',
    aspectRatio: '16:9',
    duration: 20,
    tags: ['cinema', 'sci-fi', 'astronaut', 'dramatic']
  },
  {
    id: '02-ai-filmmaking::astronaut-intro-clip',
    studio: 'cinema',
    prompt: 'Epic cinematic astronaut introduction, hero framing, planet surface backdrop, volumetric lighting, wide establishing shot',
    stylePreset: 'Cinematic',
    aspectRatio: '16:9',
    duration: 25,
    tags: ['cinema', 'sci-fi', 'astronaut', 'establishing']
  },
  {
    id: '02-ai-filmmaking::storyboard-anim-clip',
    studio: 'cinema',
    prompt: 'Animated storyboard sequence showing shot progression, rough sketch style, camera movement arrows, storyboard panel layout',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: 30,
    tags: ['cinema', 'storyboard', 'pre-visualization']
  },
  {
    id: '02-ai-filmmaking::the-last-signal-poster',
    studio: 'cinema',
    prompt: 'Movie poster for sci-fi short film, dramatic typography, astronaut silhouette against alien planet, cinematic color grade, theatrical poster layout',
    stylePreset: 'Cinematic',
    aspectRatio: '2:3',
    duration: null,
    tags: ['cinema', 'poster', 'sci-fi', 'promotional']
  },
  {
    id: '03-faceless-ai-channels::faceless-clip',
    studio: 'video',
    prompt: 'Faceless AI-generated YouTube video clip, screen-recorded style narration over stock-style B-roll, calm pacing, educational documentary feel',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 60,
    tags: ['faceless', 'youtube', 'educational', 'b-roll']
  },
  {
    id: '03-faceless-ai-channels::faceless-finance-niche',
    studio: 'video',
    prompt: 'Faceless finance niche video, clean data visualization overlay, minimalist motion graphics, professional blue and green color scheme, screen recording style',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 45,
    tags: ['faceless', 'finance', 'educational', 'motion-graphics']
  },
  {
    id: '03-faceless-ai-channels::faceless-workstation',
    studio: 'video',
    prompt: 'Faceless AI channel workstation setup, clean desk aesthetic, dual monitor setup with data dashboards, ambient lighting, productivity vibe',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['faceless', 'workstation', 'productivity', 'setup']
  },
  {
    id: '05-ai-avatars-and-influencers::emma-cafe-consistent',
    studio: 'character',
    prompt: 'Consistent AI character portrait of Emma in a cafe setting, locked facial features, warm ambient cafe lighting, photorealistic skin texture, upper body shot',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: null,
    tags: ['avatar', 'character', 'consistent', 'portrait']
  },
  {
    id: '05-ai-avatars-and-influencers::emma-cafe-motion',
    studio: 'character',
    prompt: 'AI influencer Emma in a cafe environment, subtle head turn and natural smile, locked face identity, cinematic shallow depth of field, 5 second loop',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: 5,
    tags: ['avatar', 'character', 'influencer', 'motion']
  },
  {
    id: '05-ai-avatars-and-influencers::emma-master',
    studio: 'character',
    prompt: 'Master character reference sheet for AI avatar Emma, multiple angles, consistent facial features, neutral lighting, front-facing reference',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: null,
    tags: ['avatar', 'character', 'reference', 'consistency']
  },
  {
    id: '05-ai-avatars-and-influencers::avatar-agency-suite',
    studio: 'character',
    prompt: 'AI avatar influencer agency brand identity, virtual influencer in branded content setting, professional lighting, lifestyle brand aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: null,
    tags: ['avatar', 'influencer', 'agency', 'branded']
  },
  {
    id: '07-ai-product-photography::perfume-bottle-studio',
    studio: 'image',
    prompt: 'Studio product photography of luxury perfume bottle, clean white background, soft diffused lighting, reflection on glossy surface, premium beauty aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: null,
    tags: ['product-photography', 'beauty', 'luxury', 'studio']
  },
  {
    id: '07-ai-product-photography::coffee-motion',
    studio: 'video',
    prompt: 'Product motion video of coffee product, slow rotation on turntable, warm golden hour lighting, steam rising, commercial product reveal',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: 10,
    tags: ['product-photography', 'coffee', 'motion', 'commercial']
  },
  {
    id: '07-ai-product-photography::batch-skincare-grid',
    studio: 'image',
    prompt: 'E-commerce skincare product catalog grid, multiple product shots on clean white background, consistent lighting and perspective, commercial product photography',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: null,
    tags: ['product-photography', 'skincare', 'catalog', 'e-commerce']
  },
  {
    id: '08-ai-fashion-and-virtual-tryon::fashion-lookbook-model',
    studio: 'image',
    prompt: 'Fashion editorial model shot, linen shirt on model, studio backdrop, high fashion lighting, full body pose, Vogue-style editorial photography',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: null,
    tags: ['fashion', 'lookbook', 'editorial', 'model']
  },
  {
    id: '08-ai-fashion-and-virtual-tryon::linen-shirt-vto',
    studio: 'image',
    prompt: 'Virtual try-on of linen shirt on model, accurate garment drape and texture, natural fabric folds, studio lighting, e-commerce fashion photography',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: null,
    tags: ['fashion', 'virtual-tryon', 'garment', 'e-commerce']
  },
  {
    id: '09-ai-real-estate-staging::staged-living-room',
    studio: 'image',
    prompt: 'Luxury staged living room interior, modern furniture arrangement, warm ambient lighting, architectural photography, high-end real estate aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['real-estate', 'staging', 'interior', 'luxury']
  },
  {
    id: '09-ai-real-estate-staging::living-room-staging-motion',
    studio: 'video',
    prompt: 'Virtual staging walkthrough of living room, smooth camera pan from empty to fully furnished, before and after reveal, real estate video',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 15,
    tags: ['real-estate', 'staging', 'motion', 'walkthrough']
  },
  {
    id: '10-ai-headshots-and-portraits::corporate-executive-headshot',
    studio: 'image',
    prompt: 'Corporate executive headshot, professional business attire, neutral gray background, studio softbox lighting, confident expression, LinkedIn profile quality',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: null,
    tags: ['headshot', 'corporate', 'business', 'portrait']
  },
  {
    id: '10-ai-headshots-and-portraits::creative-studio-headshot',
    studio: 'image',
    prompt: 'Creative studio headshot, artistic lighting, cinematic mood, shallow depth of field, editorial portrait style, professional yet expressive',
    stylePreset: 'Cinematic',
    aspectRatio: '1:1',
    duration: null,
    tags: ['headshot', 'creative', 'editorial', 'portrait']
  },
  {
    id: '11-ai-print-on-demand-and-merch::cyberpunk-cat-merch-tshirt',
    studio: 'image',
    prompt: 'Cyberpunk cat graphic design for t-shirt, neon color palette, vector art style, high contrast, print-ready design, urban streetwear aesthetic',
    stylePreset: 'Anime',
    aspectRatio: '1:1',
    duration: null,
    tags: ['merch', 'cyberpunk', 'vector', 'tshirt']
  },
  {
    id: '11-ai-print-on-demand-and-merch::vintage-botanical-mug-mockup',
    studio: 'image',
    prompt: 'Vintage botanical illustration mug mockup, elegant plant line art, earthy color palette, clean product presentation, e-commerce mockup style',
    stylePreset: null,
    aspectRatio: '1:1',
    duration: null,
    tags: ['merch', 'vintage', 'botanical', 'mockup']
  },
  {
    id: '12-ai-stock-content-and-licensing::corporate-handshake-stock',
    studio: 'image',
    prompt: 'Corporate handshake stock photo, diverse business professionals, bright office background, authentic candid moment, commercial stock photography',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['stock', 'corporate', 'business', 'diversity']
  },
  {
    id: '12-ai-stock-content-and-licensing::future-technology-stock',
    studio: 'image',
    prompt: 'Futuristic technology stock image, abstract data visualization, neon blue and purple tones, clean tech aesthetic, commercial stock style',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: null,
    tags: ['stock', 'technology', 'futuristic', 'abstract']
  },
  {
    id: 'character-anchor',
    studio: 'character',
    prompt: 'Reference anchor asset for UGC commercial ad, consistent visual identity, locked composition',
    stylePreset: 'UGC',
    aspectRatio: '9:16',
    duration: null,
    tags: ['01-video-ads-ugc', 'anchor', 'character']
  },
  {
    id: 'character-drift-car',
    studio: 'commercial',
    prompt: 'Character consistency drift test with car, same character in automotive context, identity locked across scenes',
    stylePreset: 'UGC',
    aspectRatio: '9:16',
    duration: null,
    tags: ['ugc', 'commercial', 'drift', 'automotive']
  },
  {
    id: 'character-drift-kitchen',
    studio: 'commercial',
    prompt: 'Character consistency drift test in kitchen environment, same character across domestic setting, identity locked across scenes',
    stylePreset: 'UGC',
    aspectRatio: '9:16',
    duration: null,
    tags: ['ugc', 'commercial', 'drift', 'kitchen']
  },
  {
    id: 'character-drift-outside',
    studio: 'commercial',
    prompt: 'Character consistency drift test outdoors, same character in natural light, identity locked across scenes',
    stylePreset: 'UGC',
    aspectRatio: '9:16',
    duration: null,
    tags: ['ugc', 'commercial', 'drift', 'outdoor']
  }
];

export function getAcademyCreateTarget(assetId) {
  const adapter = ACADEMY_STUDIO_ADAPTERS.find((a) => a.id === assetId);
  if (!adapter) return null;
  const params = {
    prompt: adapter.prompt,
    style: adapter.stylePreset,
    aspect_ratio: adapter.aspectRatio,
    duration: adapter.duration,
    'academy-template': assetId,
  };
  Object.keys(params).forEach((key) => {
    if (params[key] == null) delete params[key];
  });
  return {
    route: adapter.studio,
    params,
  };
}

export function getAcademyAssetsForStudio(studioId) {
  return ACADEMY_STUDIO_ADAPTERS.filter((adapter) => adapter.studio === studioId);
}
