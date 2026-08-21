import { ACADEMY_ASSETS, getAssetById } from './academy/catalog.js';

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
    tags: ['01-video-ads-ugc', 'character']
  },
  {
    id: 'character-drift-kitchen',
    studio: 'commercial',
    prompt: 'Character consistency drift test in kitchen, same character in domestic setting, identity locked across scenes',
    stylePreset: 'UGC',
    aspectRatio: '9:16',
    duration: null,
    tags: ['01-video-ads-ugc', 'character']
  },
  {
    id: 'character-drift-outside',
    studio: 'commercial',
    prompt: 'Character consistency drift test outdoors, same character in natural environment, identity locked across scenes',
    stylePreset: 'UGC',
    aspectRatio: '9:16',
    duration: null,
    tags: ['01-video-ads-ugc', 'character']
  },
  {
    id: '02-ai-filmmaking::astronaut-anchor',
    studio: 'cinema',
    prompt: 'Reference anchor asset for cinematic short film, consistent visual identity, locked composition',
    stylePreset: 'Cinematic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['02-filmmaking', 'anchor']
  },
  {
    id: '02-ai-filmmaking::storyboard-shot1-wide',
    studio: 'cinema',
    prompt: 'Animated storyboard wide establishing shot, cinematic framing, rough sketch to finished transition',
    stylePreset: 'Cinematic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['02-filmmaking']
  },
  {
    id: '02-ai-filmmaking::storyboard-shot2-medium',
    studio: 'cinema',
    prompt: 'Animated storyboard medium shot, cinematic framing, rough sketch to finished transition',
    stylePreset: 'Cinematic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['02-filmmaking']
  },
  {
    id: '02-ai-filmmaking::storyboard-shot3-closeup',
    studio: 'cinema',
    prompt: 'Animated storyboard close-up shot, cinematic framing, rough sketch to finished transition',
    stylePreset: 'Cinematic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['02-filmmaking']
  },
  {
    id: '03-faceless-ai-channels::faceless-anchor',
    studio: 'video',
    prompt: 'Reference anchor asset for faceless YouTube video, consistent visual identity, locked composition',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['03-faceless-channels', 'anchor', 'faceless']
  },
  {
    id: '03-faceless-ai-channels::faceless-monetization',
    studio: 'video',
    prompt: 'Faceless channel monetization visualization, earnings dashboard overlay, clean motion graphics, financial data presentation',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['03-faceless-channels', 'faceless']
  },
  {
    id: '03-faceless-ai-channels::faceless-niche-intro',
    studio: 'video',
    prompt: 'Faceless channel niche intro sequence, vertical format hook, animated text reveal, topic-specific B-roll overlay',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: 10,
    tags: ['03-faceless-channels', 'faceless']
  },
  {
    id: '04-ai-content-factories::agency-client-pitch',
    studio: 'image',
    prompt: 'Agency client pitch presentation slide, professional layout, data visualization, corporate aesthetic',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: null,
    tags: ['04-content-factories', 'pitch', 'content-factory']
  },
  {
    id: '04-ai-content-factories::agency-pitch-clip',
    studio: 'commercial',
    prompt: 'Agency pitch presentation video clip, dynamic slide transitions, professional narration style, corporate motion graphics',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: 30,
    tags: ['04-content-factories', 'clip', 'pitch', 'content-factory']
  },
  {
    id: '04-ai-content-factories::batch-production-suite',
    studio: 'image',
    prompt: 'AI content batch production suite interface, organized asset library, timeline view, clean workspace aesthetic',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: null,
    tags: ['04-content-factories', 'suite', 'content-factory']
  },
  {
    id: '04-ai-content-factories::batch-suite-clip',
    studio: 'video',
    prompt: 'Batch production suite walkthrough clip, screen-recorded workflow, organized asset management, clean UI demonstration',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: 30,
    tags: ['04-content-factories', 'clip', 'suite', 'content-factory']
  },
  {
    id: '04-ai-content-factories::content-factory-studio',
    studio: 'image',
    prompt: 'Content factory studio workspace, organized production setup, multiple monitors, professional creative environment',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: null,
    tags: ['04-content-factories', 'studio', 'content-factory']
  },
  {
    id: '04-ai-content-factories::fitness-reel-clip',
    studio: 'video',
    prompt: 'Fitness reel video clip, high-energy workout content, vertical format, motivational vibe, dynamic transitions',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: 15,
    tags: ['04-content-factories', 'clip', 'content-factory']
  },
  {
    id: '04-ai-content-factories::fitness-reel-preview',
    studio: 'image',
    prompt: 'Fitness reel preview thumbnail, bold text overlay, high contrast, attention-grabbing fitness aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: null,
    tags: ['04-content-factories', 'content-factory']
  },
  {
    id: '04-ai-content-factories::focus-anchor',
    studio: 'image',
    prompt: 'Reference anchor asset for social media content factory, consistent visual identity, locked composition',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: null,
    tags: ['04-content-factories', 'anchor', 'content-factory']
  },
  {
    id: '04-ai-content-factories::focus-loop-clip',
    studio: 'video',
    prompt: 'Focus loop video clip, ambient motion, minimalist aesthetic, smooth transitions, meditative visual experience',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: 10,
    tags: ['04-content-factories', 'clip', 'loop', 'content-factory']
  },
  {
    id: '04-ai-content-factories::get-rich-automated-thumbnail',
    studio: 'image',
    prompt: 'YouTube thumbnail design for automated content, bold text, high contrast, attention-grabbing colors, click-worthy aesthetic',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: null,
    tags: ['04-content-factories', 'thumbnail', 'content-factory']
  },
  {
    id: '04-ai-content-factories::thumbnail-motion-clip',
    studio: 'video',
    prompt: 'Thumbnail motion design clip, dynamic text animation, high energy, attention-grabbing transitions, stop-scroll effect',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: 8,
    tags: ['04-content-factories', 'clip', 'motion', 'thumbnail', 'content-factory']
  },
  {
    id: '05-ai-avatars-and-influencers::avatar-agency-suite-clip',
    studio: 'character',
    prompt: 'AI avatar agency suite presentation clip, virtual influencer in branded content, professional lifestyle aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: 5,
    tags: ['05-avatars-and-influencers', 'clip', 'suite', 'avatar']
  },
  {
    id: '05-ai-avatars-and-influencers::avatar-brand-sponsor',
    studio: 'character',
    prompt: 'Avatar brand sponsor content mockup, virtual influencer with product placement, professional commercial aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: null,
    tags: ['05-avatars-and-influencers', 'avatar']
  },
  {
    id: '05-ai-avatars-and-influencers::avatar-recording-studio',
    studio: 'character',
    prompt: 'AI avatar recording studio setup, professional voice-over booth, microphone setup, clean broadcast aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: null,
    tags: ['05-avatars-and-influencers', 'studio', 'avatar']
  },
  {
    id: '05-ai-avatars-and-influencers::avatar-sponsor-clip',
    studio: 'character',
    prompt: 'Virtual influencer brand sponsor clip, authentic product integration, lifestyle brand aesthetic, natural promotion',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: 5,
    tags: ['05-avatars-and-influencers', 'clip', 'avatar']
  },
  {
    id: '05-ai-avatars-and-influencers::avatar-studio-clip',
    studio: 'character',
    prompt: 'AI avatar studio recording clip, behind-the-scenes content creation, professional broadcast setup, clean workspace',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: 5,
    tags: ['05-avatars-and-influencers', 'clip', 'studio', 'avatar']
  },
  {
    id: '05-ai-avatars-and-influencers::emma-cafe-raw',
    studio: 'character',
    prompt: 'Raw AI character Emma in cafe setting, natural candid moment, unlocked facial features for reference, warm ambient lighting',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: null,
    tags: ['05-avatars-and-influencers', 'avatar']
  },
  {
    id: '05-ai-avatars-and-influencers::emma-clip',
    studio: 'character',
    prompt: 'AI avatar Emma video clip, natural speaking motion, locked identity, cinematic shallow depth of field, 5 second loop',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: 5,
    tags: ['05-avatars-and-influencers', 'clip', 'avatar']
  },
  {
    id: '06-ai-audio-and-music::ai-music-workstation-clip',
    studio: 'video',
    prompt: 'Professional Ai Music Workstation Clip studio setup, clean broadcast aesthetic, warm ambient lighting, organized equipment',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 15,
    tags: ['06-audio-and-music', 'clip', 'audio']
  },
  {
    id: '06-ai-audio-and-music::ai-music-workstation',
    studio: 'image',
    prompt: 'Professional Ai Music Workstation studio setup, clean broadcast aesthetic, warm ambient lighting, organized equipment',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['06-audio-and-music', 'audio']
  },
  {
    id: '06-ai-audio-and-music::dubbing-studio-clip',
    studio: 'video',
    prompt: 'Professional Dubbing Studio Clip studio setup, clean broadcast aesthetic, warm ambient lighting, organized equipment',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 15,
    tags: ['06-audio-and-music', 'clip', 'studio', 'audio']
  },
  {
    id: '06-ai-audio-and-music::dubbing-studio',
    studio: 'image',
    prompt: 'Professional Dubbing Studio studio setup, clean broadcast aesthetic, warm ambient lighting, organized equipment',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['06-audio-and-music', 'studio', 'audio']
  },
  {
    id: '06-ai-audio-and-music::podcast-audio-console',
    studio: 'image',
    prompt: 'Professional Podcast Audio Console studio setup, clean broadcast aesthetic, warm ambient lighting, organized equipment',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['06-audio-and-music', 'audio']
  },
  {
    id: '06-ai-audio-and-music::podcast-console-clip',
    studio: 'video',
    prompt: 'Professional Podcast Console Clip clip, behind-the-scenes production, smooth camera movement, clean broadcast aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 15,
    tags: ['06-audio-and-music', 'clip', 'audio']
  },
  {
    id: '06-ai-audio-and-music::singing-vocal-studio-clip',
    studio: 'video',
    prompt: 'Professional Singing Vocal Studio Clip studio setup, clean broadcast aesthetic, warm ambient lighting, organized equipment',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 15,
    tags: ['06-audio-and-music', 'clip', 'studio', 'audio']
  },
  {
    id: '06-ai-audio-and-music::singing-vocal-studio',
    studio: 'image',
    prompt: 'Professional Singing Vocal Studio studio setup, clean broadcast aesthetic, warm ambient lighting, organized equipment',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['06-audio-and-music', 'studio', 'audio']
  },
  {
    id: '06-ai-audio-and-music::voice-studio-clip',
    studio: 'video',
    prompt: 'Professional Voice Studio Clip clip, behind-the-scenes production, smooth camera movement, clean broadcast aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 15,
    tags: ['06-audio-and-music', 'clip', 'studio', 'audio']
  },
  {
    id: '06-ai-audio-and-music::voice-studio-setup',
    studio: 'image',
    prompt: 'Professional Voice Studio Setup studio setup, clean broadcast aesthetic, warm ambient lighting, organized equipment',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['06-audio-and-music', 'studio', 'audio']
  },
  {
    id: '07-ai-product-photography::batch-skincare-grid-clip',
    studio: 'video',
    prompt: 'Skincare product batch catalog motion, rotating product grid, clean white background, consistent lighting, commercial reveal',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: 10,
    tags: ['07-product-photography', 'clip', 'grid', 'product-photography']
  },
  {
    id: '07-ai-product-photography::coffee-before-after',
    studio: 'image',
    prompt: 'Coffee product before and after comparison, side-by-side layout, clean product photography, commercial aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['07-product-photography', 'before-after', 'product-photography']
  },
  {
    id: '07-ai-product-photography::perfume-before-after',
    studio: 'image',
    prompt: 'Perfume product before and after comparison, luxury aesthetic, side-by-side layout, premium beauty photography',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['07-product-photography', 'before-after', 'product-photography']
  },
  {
    id: '07-ai-product-photography::perfume-motion',
    studio: 'video',
    prompt: 'Luxury perfume bottle motion video, slow rotation on turntable, golden hour lighting, steam effects, premium product reveal',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 10,
    tags: ['07-product-photography', 'motion', 'product-photography']
  },
  {
    id: '07-ai-product-photography::product-agency-studio-clip',
    studio: 'video',
    prompt: 'Professional Product Agency Studio Clip clip, behind-the-scenes production, smooth camera movement, clean broadcast aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: 10,
    tags: ['07-product-photography', 'clip', 'studio', 'product-photography']
  },
  {
    id: '07-ai-product-photography::product-agency-studio',
    studio: 'image',
    prompt: 'Product photography agency studio setup, professional lighting rig, organized workspace, premium commercial aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '1:1',
    duration: null,
    tags: ['07-product-photography', 'studio', 'product-photography']
  },
  {
    id: '08-ai-fashion-and-virtual-tryon::denim-model-clip',
    studio: 'video',
    prompt: 'Denim model video clip, natural fabric movement, studio lighting, full body pose, e-commerce fashion motion',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: 15,
    tags: ['08-fashion-and-virtual-tryon', 'clip', 'virtual-tryon', 'fashion']
  },
  {
    id: '08-ai-fashion-and-virtual-tryon::denim-model-measurements',
    studio: 'image',
    prompt: 'Denim model measurements specification sheet, technical garment overlay, clean white background, product detail view',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: null,
    tags: ['08-fashion-and-virtual-tryon', 'measurements', 'virtual-tryon', 'fashion']
  },
  {
    id: '08-ai-fashion-and-virtual-tryon::fashion-lookbook-loop',
    studio: 'video',
    prompt: 'Fashion lookbook video loop, smooth model transitions, seasonal collection flow, editorial aesthetic, Vogue-style motion',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: 10,
    tags: ['08-fashion-and-virtual-tryon', 'loop', 'virtual-tryon', 'fashion']
  },
  {
    id: '08-ai-fashion-and-virtual-tryon::linen-shirt-motion',
    studio: 'video',
    prompt: 'Linen shirt virtual try-on motion, natural fabric drape and movement, model wearing garment, studio lighting, e-commerce fashion',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: 15,
    tags: ['08-fashion-and-virtual-tryon', 'motion', 'virtual-tryon', 'fashion']
  },
  {
    id: '08-ai-fashion-and-virtual-tryon::mannequin-grid-alignment',
    studio: 'image',
    prompt: 'Mannequin garment grid alignment, technical specifications overlay, clean product layout, e-commerce consistency view',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: null,
    tags: ['08-fashion-and-virtual-tryon', 'grid', 'alignment', 'virtual-tryon', 'fashion']
  },
  {
    id: '08-ai-fashion-and-virtual-tryon::mannequin-grid-clip',
    studio: 'video',
    prompt: 'Mannequin garment grid motion clip, synchronized product reveal, organized visual alignment, commercial fashion aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '9:16',
    duration: 15,
    tags: ['08-fashion-and-virtual-tryon', 'clip', 'grid', 'virtual-tryon', 'fashion']
  },
  {
    id: '09-ai-real-estate-staging::bedroom-staging-motion',
    studio: 'video',
    prompt: 'Luxury bedroom virtual staging walkthrough, smooth camera pan, warm ambient lighting, high-end real estate video',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 15,
    tags: ['09-real-estate-staging', 'motion', 'real-estate']
  },
  {
    id: '09-ai-real-estate-staging::empty-to-staged-before-after',
    studio: 'image',
    prompt: 'Empty room to staged room before and after, side-by-side comparison, luxury furniture reveal, real estate transformation',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['09-real-estate-staging', 'before-after', 'real-estate']
  },
  {
    id: '09-ai-real-estate-staging::staged-bedroom-luxury',
    studio: 'image',
    prompt: 'Luxury staged bedroom interior, modern furniture arrangement, warm ambient lighting, architectural photography, high-end aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['09-real-estate-staging', 'real-estate']
  },
  {
    id: '10-ai-headshots-and-portraits::creative-studio-headshot-motion',
    studio: 'video',
    prompt: 'Creative studio headshot motion clip, subtle head movement, cinematic mood lighting, shallow depth of field, editorial portrait',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 10,
    tags: ['10-headshots-and-portraits', 'motion', 'studio', 'headshot']
  },
  {
    id: '10-ai-headshots-and-portraits::headshot-lighting-motion',
    studio: 'video',
    prompt: 'Headshot lighting setup motion, smooth light adjustment, professional studio workflow, before and after lighting reveal',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 10,
    tags: ['10-headshots-and-portraits', 'motion', 'headshot']
  },
  {
    id: '10-ai-headshots-and-portraits::headshot-transformation-before-after',
    studio: 'image',
    prompt: 'Headshot transformation before and after, casual selfie to studio portrait, professional retouching comparison, dramatic reveal',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: null,
    tags: ['10-headshots-and-portraits', 'before-after', 'headshot']
  },
  {
    id: '10-ai-headshots-and-portraits::headshot-transformation-motion',
    studio: 'video',
    prompt: 'Headshot transformation motion clip, seamless transition from casual to professional, identity locked, smooth morph effect',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 15,
    tags: ['10-headshots-and-portraits', 'motion', 'headshot']
  },
  {
    id: '11-ai-print-on-demand-and-merch::merch-design-motion',
    studio: 'video',
    prompt: 'Merch design motion video, rotating product reveal, print-ready graphic animation, commercial merchandise showcase',
    stylePreset: null,
    aspectRatio: '1:1',
    duration: 10,
    tags: ['11-print-on-demand-and-merch', 'motion', 'merch']
  },
  {
    id: '11-ai-print-on-demand-and-merch::merch-design-vector-art',
    studio: 'image',
    prompt: 'Vector art design for merchandise, clean line art, high contrast, print-ready graphic, urban streetwear aesthetic',
    stylePreset: 'Anime',
    aspectRatio: '1:1',
    duration: null,
    tags: ['11-print-on-demand-and-merch', 'merch']
  },
  {
    id: '11-ai-print-on-demand-and-merch::merch-design-vector-motion',
    studio: 'video',
    prompt: 'Vector art merch design motion clip, animated graphic reveal, clean line work, high contrast, print-ready aesthetic',
    stylePreset: 'Anime',
    aspectRatio: '1:1',
    duration: 10,
    tags: ['11-print-on-demand-and-merch', 'motion', 'merch']
  },
  {
    id: '11-ai-print-on-demand-and-merch::vintage-botanical-mug-motion',
    studio: 'video',
    prompt: 'Vintage botanical mug design motion, rotating product reveal, elegant plant line art animation, earthy color palette',
    stylePreset: null,
    aspectRatio: '1:1',
    duration: 10,
    tags: ['11-print-on-demand-and-merch', 'motion', 'merch']
  },
  {
    id: '12-ai-stock-content-and-licensing::future-technology-stock-motion',
    studio: 'video',
    prompt: 'Futuristic technology stock video motion, abstract data visualization animation, neon blue and purple tones, clean tech aesthetic',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: 20,
    tags: ['12-stock-content-and-licensing', 'motion', 'stock']
  },
  {
    id: '12-ai-stock-content-and-licensing::stock-catalog-motion',
    studio: 'video',
    prompt: 'Stock catalog motion sequence, rapid asset showcase, clean transitions, commercial licensing preview aesthetic',
    stylePreset: 'Photorealistic',
    aspectRatio: '16:9',
    duration: 20,
    tags: ['12-stock-content-and-licensing', 'motion', 'stock']
  },
  {
    id: '13-ai-tools-mastery::camera-motion-matrix-motion',
    studio: 'video',
    prompt: 'Camera motion matrix visualization, technical diagram, shot types grid, cinematography reference chart, educational layout',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: 20,
    tags: ['13-tools-mastery', 'motion', 'tools']
  },
  {
    id: '13-ai-tools-mastery::camera-motion-matrix',
    studio: 'image',
    prompt: 'Camera motion matrix visualization, technical diagram, shot types grid, cinematography reference chart, educational layout',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: null,
    tags: ['13-tools-mastery', 'motion', 'tools']
  },
  {
    id: '13-ai-tools-mastery::model-benchmark-comparison',
    studio: 'image',
    prompt: 'AI model benchmark comparison chart, side-by-side performance metrics, clean data visualization, technical comparison layout',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: null,
    tags: ['13-tools-mastery', 'tools']
  },
  {
    id: '13-ai-tools-mastery::tools-workflow-motion',
    studio: 'video',
    prompt: 'AI tools workflow motion graphic, step-by-step process animation, clean UI transitions, educational workflow visualization',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: 20,
    tags: ['13-tools-mastery', 'motion', 'tools']
  },
  {
    id: '14-ai-freelancing-and-agency-business::agency-pricing-deck-mockup',
    studio: 'image',
    prompt: 'Agency pricing deck mockup slide, professional presentation layout, data visualization, corporate pricing table aesthetic',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: null,
    tags: ['14-freelancing-and-agency-business', 'freelancing']
  },
  {
    id: '14-ai-freelancing-and-agency-business::agency-pricing-deck-motion',
    studio: 'video',
    prompt: 'Agency pricing deck motion presentation, dynamic slide transitions, data visualization animation, corporate motion graphics',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: 20,
    tags: ['14-freelancing-and-agency-business', 'motion', 'freelancing']
  },
  {
    id: '14-ai-freelancing-and-agency-business::client-dashboard-metrics',
    studio: 'image',
    prompt: 'Client dashboard metrics screenshot, analytics overview, clean data visualization, professional SaaS interface aesthetic',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: null,
    tags: ['14-freelancing-and-agency-business', 'dashboard', 'freelancing']
  },
  {
    id: '14-ai-freelancing-and-agency-business::client-dashboard-motion',
    studio: 'video',
    prompt: 'Client dashboard metrics motion, animated data visualization, smooth chart transitions, professional analytics interface',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: 20,
    tags: ['14-freelancing-and-agency-business', 'motion', 'dashboard', 'freelancing']
  },
  {
    id: '15-ai-agents-and-vibe-coding::micro-tool-app-interface',
    studio: 'image',
    prompt: 'Micro-tool app interface design, clean UI layout, modern web app aesthetic, functional dashboard mockup, product design',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: null,
    tags: ['15-agents-and-vibe-coding', 'app-interface', 'vibe-coding']
  },
  {
    id: '15-ai-agents-and-vibe-coding::micro-tool-app-motion',
    studio: 'video',
    prompt: 'Micro-tool app interface motion, smooth UI transitions, modern web app interactions, clean product design animation',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: 20,
    tags: ['15-agents-and-vibe-coding', 'motion', 'vibe-coding']
  },
  {
    id: '15-ai-agents-and-vibe-coding::vibe-coding-workspace-motion',
    studio: 'video',
    prompt: 'Vibe coding workspace setup, modern development environment, clean desk aesthetic, dual monitor setup, creative coding vibe',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: 20,
    tags: ['15-agents-and-vibe-coding', 'motion', 'workspace', 'vibe-coding']
  },
  {
    id: '15-ai-agents-and-vibe-coding::vibe-coding-workspace',
    studio: 'image',
    prompt: 'Vibe coding workspace setup, modern development environment, clean desk aesthetic, dual monitor setup, creative coding vibe',
    stylePreset: null,
    aspectRatio: '16:9',
    duration: null,
    tags: ['15-agents-and-vibe-coding', 'workspace', 'vibe-coding']
  }
];

const ADAPTER_MAP = new Map(ACADEMY_STUDIO_ADAPTERS.map((a) => [a.id, a]));

export function getAcademyCreateTarget(assetId) {
  const adapter = ADAPTER_MAP.get(assetId);
  if (!adapter) return null;
  return {
    route: adapter.studio,
    params: {
      prompt: adapter.prompt,
      style: adapter.stylePreset,
      aspect_ratio: adapter.aspectRatio,
      duration: adapter.duration,
      'academy-template': assetId
    }
  };
}

export function getAcademyAssetsForStudio(studioId) {
  return ACADEMY_STUDIO_ADAPTERS.filter((a) => a.studio === studioId);
}
