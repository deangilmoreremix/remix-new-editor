// Template Specifications for enhanced template data
// This file contains enhanced specifications for all templates

import { NICHE_TEMPLATE_SPECS } from './nicheTemplateSpecs.js';
import { MATRIX_TEMPLATE_SPECS } from './matrixTemplateSpecs.js';

export const TEMPLATE_SPECS = {
  'tiktok-video': {
    coreUseCase: 'Viral 9:16 short videos',
    uiDescription: 'Create vertical TikTok-style videos with strong opening hooks, motion, and social-native energy.',
    promptGoal: 'Turn a simple idea into a highly watchable short-form vertical concept.',
    visualStyle: 'Trend-aware, cinematic-social, energetic, polished',
    sceneBlueprint: ['Hook frame', 'subject reveal', 'motion beat', 'visual payoff', 'CTA/end beat'],
    cinematography: 'Vertical framing, hook-first composition, dynamic close-ups, fast push-ins, punchy transitions',
    enhancerKeywords: 'viral tiktok video, 9:16 social video, trending motion, hook-first pacing, scroll-stopping visuals',
    negativePrompt: 'weak hook, flat pacing, generic stock look, cluttered frame, no focal subject',
    outputPackage: ['master prompt', 'short-form scene prompts', 'hook prompt', 'CTA ending prompt']
  },
  'instagram-reel': {
    coreUseCase: 'Aesthetic reels',
    uiDescription: 'Build polished reels with mood, beauty, motion, and visually premium pacing.',
    promptGoal: 'Create aesthetic short-form reels that feel elegant and cinematic.',
    visualStyle: 'Clean, aesthetic, aspirational, premium social',
    sceneBlueprint: ['Mood opener', 'detail sequence', 'movement moment', 'reveal', 'stylish ending frame'],
    cinematography: 'Smooth vertical camera motion, shallow depth of field, elegant pans, polished transitions',
    enhancerKeywords: 'instagram reel aesthetic, cinematic motion, polished vertical content, premium social visuals',
    negativePrompt: 'dull composition, cheap social look, poor color harmony, weak movement',
    outputPackage: ['master prompt', 'reel prompt pack', 'motion cues', 'ending frame prompt']
  },
  'youtube-thumbnail': {
    coreUseCase: 'High-click thumbnails',
    uiDescription: 'Create bold, expressive thumbnails designed to maximize clicks and clarity.',
    promptGoal: 'Turn a video idea into a bold click-driven thumbnail concept.',
    visualStyle: 'Bold, high-contrast, expressive, platform-optimized',
    sceneBlueprint: ['Main face/subject focus', 'contrast background', 'visual tension element', 'text-safe space'],
    cinematography: 'Dramatic framing, punchy composition, center-weighted focal emphasis',
    enhancerKeywords: 'high click-through thumbnail, bold expression, contrast composition, youtube thumbnail design',
    negativePrompt: 'muddy contrast, tiny subject, text clutter, weak emotion, confusing layout',
    outputPackage: ['thumbnail prompt', 'alt composition prompt', 'expression variants']
  },
  'reaction-thumbnail': {
    coreUseCase: 'Expressive reaction art',
    uiDescription: 'Generate exaggerated reaction imagery for content thumbnails.',
    promptGoal: 'Create a high-emotion reaction image with clear focal point and platform-ready impact.',
    visualStyle: 'Expressive, exaggerated, bold, internet-native',
    sceneBlueprint: ['Face close-up', 'dramatic background cue', 'emotional emphasis', 'text-safe negative space'],
    cinematography: 'Tight facial framing, strong contrast composition',
    enhancerKeywords: 'reaction face, expressive thumbnail, exaggerated emotion, dramatic expression, click-focused design',
    negativePrompt: 'neutral expression, low emotion, busy background, poor subject separation',
    outputPackage: ['reaction prompt', 'facial-expression variants', 'background variants']
  },
  'short-form-ad': {
    coreUseCase: 'Product promos for feeds',
    uiDescription: 'Create direct, high-conversion ad videos optimized for social attention spans.',
    promptGoal: 'Build a short ad with hook, product focus, benefit visuals, and a CTA.',
    visualStyle: 'Fast, persuasive, polished, conversion-aware',
    sceneBlueprint: ['Hook', 'product intro', 'benefit demo', 'trust cue', 'CTA'],
    cinematography: 'Fast social pacing, tight product close-ups, clean reveal shots, ad-style rhythm',
    enhancerKeywords: 'short-form ad, product promo video, feed-optimized ad, high-conversion social creative',
    negativePrompt: 'slow pacing, confusing product focus, weak CTA, cheap ad style',
    outputPackage: ['ad master prompt', 'scene prompts', 'CTA prompt', 'hook prompt']
  },
  'story-highlight-cover': {
    coreUseCase: 'Minimal story icons',
    uiDescription: 'Create clean icon-based highlight covers that feel branded and polished.',
    promptGoal: 'Turn brand or topic categories into elegant minimalist cover designs.',
    visualStyle: 'Minimal, iconographic, clean, branded',
    sceneBlueprint: ['Single icon focus', 'circular composition', 'balanced negative space', 'matching set styling'],
    cinematography: 'Centered icon geometry, minimal composition',
    enhancerKeywords: 'minimalist highlight cover, clean icon design, branded story cover, simple premium visual',
    negativePrompt: 'clutter, over-detail, inconsistent icon style, weak contrast',
    outputPackage: ['cover prompt', 'icon variations', 'colorway variations']
  },
  'profile-picture': {
    coreUseCase: 'AI profile photos',
    uiDescription: 'Create polished profile images for personal brands, creators, or professionals.',
    promptGoal: 'Turn a subject into a clean, premium profile image with strong presence.',
    visualStyle: 'Professional, polished, flattering, premium',
    sceneBlueprint: ['Portrait focus', 'clean background', 'face clarity', 'identity-driven styling'],
    cinematography: 'Portrait framing, shallow depth feel, face-centered composition, flattering light simulation',
    enhancerKeywords: 'professional profile photo, creator headshot, premium portrait, clean identity image',
    negativePrompt: 'distorted face, flat skin texture, awkward crop, cluttered background',
    outputPackage: ['portrait prompt', 'background variants', 'professional style variants']
  },
  '1920s-style': {
    coreUseCase: '1920s aesthetic',
    uiDescription: 'Transform into roaring twenties art deco style.',
    promptGoal: 'Generate authentic 1920s art deco aesthetic.',
    visualStyle: 'Art deco, jazz age, vintage, glamorous',
    sceneBlueprint: ['Art deco backdrop', 'vintage styling', 'gold accents', 'period costume'],
    cinematography: 'Vintage portrait framing, art deco composition',
    enhancerKeywords: '1920s style, art deco aesthetic, jazz age, vintage glamour',
    negativePrompt: 'modern elements, anachronistic, poor period detail, flat style',
    outputPackage: ['period prompt', 'style variants', 'setting options']
  },
  '1950s-style': {
    coreUseCase: '1950s aesthetic',
    uiDescription: 'Transform into mid-century Americana style.',
    promptGoal: 'Generate authentic 1950s nostalgia.',
    visualStyle: 'Mid-century, Americana, retro, nostalgic',
    sceneBlueprint: ['Period backdrop', 'retro styling', 'classic car optional', 'diner setting'],
    cinematography: 'Period-appropriate framing, vintage color palette',
    enhancerKeywords: '1950s style, mid-century Americana, retro aesthetic, vintage nostalgia',
    negativePrompt: 'modern elements, anachronistic, poor period detail, flat colors',
    outputPackage: ['period prompt', 'setting variants', 'style options']
  },
  '1970s-style': {
    coreUseCase: '1970s aesthetic',
    uiDescription: 'Transform into groovy seventies retro style.',
    promptGoal: 'Generate authentic 1970s vibes.',
    visualStyle: 'Groovy, psychedelic, retro, warm tones',
    sceneBlueprint: ['Retro backdrop', '70s styling', 'warm colors', 'period fashion'],
    cinematography: 'Vintage framing, warm color grading',
    enhancerKeywords: '1970s style, groovy seventies, retro aesthetic, psychedelic vibes',
    negativePrompt: 'modern elements, cool tones, anachronistic, flat colors',
    outputPackage: ['period prompt', 'style variants', 'setting options']
  },
  '1980s-style': {
    coreUseCase: '1980s aesthetic',
    uiDescription: 'Transform into neon-lit synthwave eighties look.',
    promptGoal: 'Generate authentic 1980s neon aesthetic.',
    visualStyle: 'Neon, synthwave, retro-futuristic, Miami Vice',
    sceneBlueprint: ['Neon backdrop', 'synthwave styling', 'hot colors', 'retro fashion'],
    cinematography: 'Neon-lit framing, hot color palette',
    enhancerKeywords: '1980s style, synthwave, neon lights, retro-futuristic, Miami Vice aesthetic',
    negativePrompt: 'muted colors, modern elements, anachronistic, flat lighting',
    outputPackage: ['period prompt', 'neon variants', 'setting options']
  },
  'drone-fpv': {
    coreUseCase: 'FPV drone shots',
    uiDescription: 'Create first-person drone flythrough footage.',
    promptGoal: 'Generate immersive FPV drone perspectives.',
    visualStyle: 'Dynamic, immersive, aerial, fast-paced',
    sceneBlueprint: ['Aerial approach', 'obstacle navigation', 'dynamic movement', 'reveal shot'],
    cinematography: 'FPV perspective, dynamic movement, obstacle avoidance style',
    enhancerKeywords: 'drone FPV shot, first person drone, aerial flythrough, dynamic movement',
    negativePrompt: 'static, smooth gimbal, boring movement, slow pace',
    outputPackage: ['flight prompt', 'path variants', 'speed options']
  },
  'dolly-zoom': {
    coreUseCase: 'Vertigo effect',
    uiDescription: 'Create Hitchcock-style dolly zoom effects.',
    promptGoal: 'Generate dramatic vertigo effect moments.',
    visualStyle: 'Dramatic, disorienting, Hitchcock-inspired, cinematic',
    sceneBlueprint: ['Subject center', 'background stretch', 'dramatic emphasis', 'vertigo effect'],
    cinematography: 'Dolly zoom technique, dramatic compression effect',
    enhancerKeywords: 'dolly zoom, vertigo effect, Hitchcock style, dramatic compression',
    negativePrompt: 'stable background, no distortion, flat composition, normal perspective',
    outputPackage: ['dolly prompt', 'intensity variants', 'scene options']
  },
  'car-chase': {
    coreUseCase: 'Car chase scenes',
    uiDescription: 'Create action movie car chase sequences.',
    promptGoal: 'Generate high-speed chase dynamics.',
    visualStyle: 'Fast, action-packed, cinematic chase, dramatic',
    sceneBlueprint: ['Lead vehicle', 'pursuit vehicles', 'dynamic movement', 'dramatic backdrop'],
    cinematography: 'Dynamic tracking shots, chase angles, speed emphasis',
    enhancerKeywords: 'car chase scene, action movie chase, high speed pursuit, dynamic movement',
    negativePrompt: 'static, slow movement, boring angles, no action',
    outputPackage: ['chase prompt', 'angle variants', 'speed options']
  },
  'matrix-shot': {
    coreUseCase: 'Matrix-style shots',
    uiDescription: 'Create frozen-time multi-angle camera rotation.',
    promptGoal: 'Generate Matrix-style frozen moment with orbit camera.',
    visualStyle: 'Frozen motion, 360-degree, Matrix-inspired, dramatic',
    sceneBlueprint: ['Frozen action', 'camera orbit', 'dramatic angle', 'time freeze'],
    cinematography: '360-degree camera rotation, frozen moment, Matrix bullet-time',
    enhancerKeywords: 'Matrix shot, frozen time, 360 orbit, bullet-time effect',
    negativePrompt: 'normal speed, static camera, no movement, flat composition',
    outputPackage: ['matrix prompt', 'angle variants', 'speed options']
  },
  '3d-figurine': {
    coreUseCase: '3D figurine style',
    uiDescription: 'Turn yourself into a collectible 3D figure.',
    promptGoal: 'Create realistic 3D collectible figurine renders.',
    visualStyle: '3D render, collectible, detailed, miniature',
    sceneBlueprint: ['Figure pose', 'display stand', 'detailed sculpt', 'miniature lighting'],
    cinematography: 'Macro product photography, detail capture',
    enhancerKeywords: '3D figurine, collectible figure, miniature render, detailed sculpt',
    negativePrompt: 'flat illustration, poor 3D quality, unrealistic material, blurry details',
    outputPackage: ['figurine prompt', 'pose variants', 'display options']
  },
  'glass-ball': {
    coreUseCase: 'Glass ball scenes',
    uiDescription: 'Create scenes captured inside crystal glass balls.',
    promptGoal: 'Generate magical glass ball refraction effects.',
    visualStyle: 'Magical, refraction, crystal, miniature world',
    sceneBlueprint: ['Glass sphere', 'refracted scene', 'bokeh background', 'magical light'],
    cinematography: 'Macro glass photography, refraction capture',
    enhancerKeywords: 'glass ball effect, crystal sphere, magical refraction, miniature world',
    negativePrompt: 'flat image, no refraction, poor glass quality, blurry scene',
    outputPackage: ['sphere prompt', 'scene variants', 'lighting options']
  },
  'action-figure': {
    coreUseCase: 'Action figure style',
    uiDescription: 'Turn yourself into a collectible action figure.',
    promptGoal: 'Create realistic action figure/collectible toy style render.',
    visualStyle: '3D render, plastic material, collectible toy, packaging design',
    sceneBlueprint: ['Figure pose', 'packaging backdrop', 'plastic material', 'collector display'],
    cinematography: 'Product photography style, clean presentation framing',
    enhancerKeywords: 'action figure style, collectible toy, 3D render, plastic material, packaging design',
    negativePrompt: 'flat illustration, poor 3D quality, unrealistic material, cluttered packaging',
    outputPackage: ['master prompt', 'packaging variants', 'display options']
  },
  'age-progression': {
    coreUseCase: 'Age progression',
    uiDescription: 'See yourself at different ages.',
    promptGoal: 'Generate realistic age progression/regression.',
    visualStyle: 'Realistic aging, natural progression, preserved identity',
    sceneBlueprint: ['Base face', 'age markers', 'skin texture', 'natural aging'],
    cinematography: 'Consistent portrait framing, matched lighting',
    enhancerKeywords: 'age progression, realistic aging, natural transformation, preserved features',
    negativePrompt: 'unrealistic aging, distorted features, poor skin texture, identity loss',
    outputPackage: ['age prompt', 'year variants', 'intensity options']
  },
  'anime-converter': {
    coreUseCase: 'Anime transformations',
    uiDescription: 'Transform any photo into beautiful anime-style art with vivid colors and expressive features.',
    promptGoal: 'Create a faithful anime interpretation while preserving the subject essence.',
    visualStyle: 'Vibrant, expressive, hand-drawn aesthetic, Japanese animation',
    sceneBlueprint: ['Character focus', 'anime background', 'expressive features', 'vibrant color palette'],
    cinematography: 'Anime-style framing with dramatic angles and expressive character focus',
    enhancerKeywords: 'anime style, Japanese animation, Studio Ghibli inspired, vibrant colors, expressive',
    negativePrompt: 'uncanny valley, poorly defined lines, washed out colors, stiff pose',
    outputPackage: ['master prompt', 'style variants', 'background options']
  },
  'asmr-video': {
    coreUseCase: 'ASMR content',
    uiDescription: 'Create satisfying slow-motion ASMR video content.',
    promptGoal: 'Generate visually satisfying ASMR moments.',
    visualStyle: 'Calming, detailed, satisfying, close-up',
    sceneBlueprint: ['Close-up detail', 'slow motion', 'texture focus', 'satisfying reveal'],
    cinematography: 'Macro close-ups, slow-motion capture, detail-oriented',
    enhancerKeywords: 'ASMR video, satisfying close-up, slow motion, texture detail, calming',
    negativePrompt: 'fast cuts, jarring motion, poor detail, chaotic composition',
    outputPackage: ['master prompt', 'macro shots', 'motion options']
  },
  'banner-creator': {
    coreUseCase: 'Channel/page banners',
    uiDescription: 'Create wide cinematic banners for channels, pages, and branded profiles.',
    promptGoal: 'Turn a brand or content theme into a wide-format hero banner.',
    visualStyle: 'Cinematic, wide, polished, branded',
    sceneBlueprint: ['Wide composition', 'main focal zone', 'supporting visual elements', 'title-safe spacing'],
    cinematography: 'Still-image cinematic layout with panoramic framing and layered depth',
    enhancerKeywords: 'cinematic banner, wide hero image, channel art, branded panoramic composition',
    negativePrompt: 'cramped composition, poor safe zones, weak focal hierarchy, muddy layout',
    outputPackage: ['banner prompt', 'wide composition variants', 'title-safe layout prompt']
  },
  'billboard-ad': {
    coreUseCase: 'Billboard advertisements',
    uiDescription: 'Create ultra-wide billboard advertisement designs.',
    promptGoal: 'Generate eye-catching outdoor advertising compositions.',
    visualStyle: 'Bold, impactful, readable-at-distance, advertising',
    sceneBlueprint: ['Main visual', 'brand element', 'headline space', 'high-contrast'],
    cinematography: 'Wide panoramic composition, readable hierarchy',
    enhancerKeywords: 'billboard advertisement, outdoor advertising, wide format, bold design',
    negativePrompt: 'cluttered, poor readability, weak hierarchy, cramped layout',
    outputPackage: ['master prompt', 'layout variants', 'text placement options']
  },
  'building-explosion': {
    coreUseCase: 'Building explosion VFX',
    uiDescription: 'Create Hollywood-grade building explosion effects.',
    promptGoal: 'Generate dramatic building destruction sequences.',
    visualStyle: 'Explosive, dramatic, Hollywood VFX, destruction',
    sceneBlueprint: ['Building setup', 'detonation point', 'explosion expansion', 'debris field'],
    cinematography: 'Wide establishing, slow-motion detail, dramatic angles',
    enhancerKeywords: 'building explosion, Hollywood VFX, destruction sequence, dramatic explosion',
    negativePrompt: 'weak explosion, no debris, poor physics, unrealistic destruction',
    outputPackage: ['master prompt', 'explosion variants', 'angle options']
  },
  'bullet-time': {
    coreUseCase: 'Matrix-style effects',
    uiDescription: 'Create Matrix-style freeze-frame rotation effects.',
    promptGoal: 'Generate dramatic bullet-time moments with frozen action.',
    visualStyle: 'Frozen motion, dramatic angles, Matrix-inspired, time-freeze',
    sceneBlueprint: ['Frozen action pose', 'circular camera movement', 'dramatic backdrop', 'time-frozen elements'],
    cinematography: '360-degree bullet-time rotation, frozen moment framing',
    enhancerKeywords: 'bullet time effect, Matrix-style freeze frame, slow motion rotation, epic stunt',
    negativePrompt: 'normal speed, static camera, flat composition, no drama',
    outputPackage: ['master prompt', 'angle variants', 'motion options']
  },
  'car-explosion': {
    coreUseCase: 'Car explosion effects',
    uiDescription: 'Create action movie car explosion effects.',
    promptGoal: 'Generate dramatic vehicle destruction sequences.',
    visualStyle: 'Explosive, action-movie, fire, dramatic',
    sceneBlueprint: ['Vehicle approach', 'impact moment', 'fireball', 'shockwave'],
    cinematography: 'Action movie angles, slow-motion fireballs, dramatic wide shots',
    enhancerKeywords: 'car explosion, action movie explosion, vehicle destruction, fireball effect',
    negativePrompt: 'weak explosion, no fire, poor physics, unrealistic damage',
    outputPackage: ['master prompt', 'explosion variants', 'angle options']
  },
  'comic-book': {
    coreUseCase: 'Comic book art',
    uiDescription: 'Turn photos into bold American comic book style illustrations.',
    promptGoal: 'Create bold, dramatic comic book art with strong lines and vibrant colors.',
    visualStyle: 'Bold, high-contrast, dynamic, Marvel/DC inspired',
    sceneBlueprint: ['Dynamic pose', 'dramatic background', 'bold outlines', 'comic panel style'],
    cinematography: 'Dramatic low/high angles, dynamic action framing',
    enhancerKeywords: 'American comic book style, bold colors, dynamic action, superhero pose, ink lines',
    negativePrompt: 'soft lines, muted colors, static pose, poor action composition',
    outputPackage: ['master prompt', 'action variants', 'panel layouts']
  },
  'cyberpunk-style': {
    coreUseCase: 'Cyberpunk transformations',
    uiDescription: 'Create neon-soaked cyberpunk art with futuristic elements.',
    promptGoal: 'Generate cyberpunk art with neon lights and high-tech atmosphere.',
    visualStyle: 'Neon-lit, futuristic, high-tech, Blade Runner aesthetic',
    sceneBlueprint: ['Neon city backdrop', 'chrome elements', 'holographic details', 'rain-soaked streets'],
    cinematography: 'Dramatic neon lighting, futuristic angles, high-contrast',
    enhancerKeywords: 'cyberpunk style, neon lights, futuristic, high tech low life, Blade Runner aesthetic',
    negativePrompt: 'natural lighting, organic feel, retro style, clean modern look',
    outputPackage: ['master prompt', 'environment variants', 'character options']
  },
  'disintegration': {
    coreUseCase: 'Thanos snap effect',
    uiDescription: 'Create Thanos-style disintegration effects.',
    promptGoal: 'Generate dramatic dissolve/disintegration moments.',
    visualStyle: 'Dissolving, particle effect, dramatic, Marvel-style',
    sceneBlueprint: ['Character pose', 'dissolve start', 'particle dispersal', 'empty space'],
    cinematography: 'Dramatic character framing, particle detail capture',
    enhancerKeywords: 'Thanos snap disintegration, dissolve effect, particle dispersal, Marvel style',
    negativePrompt: 'solid appearance, no particles, poor dissolve, static pose',
    outputPackage: ['master prompt', 'dissolve variants', 'intensity options']
  },
  'disney-pixar': {
    coreUseCase: 'Disney/Pixar style',
    uiDescription: 'Create Pixar-quality 3D character renders.',
    promptGoal: 'Generate heartwarming Pixar-style 3D animated characters.',
    visualStyle: '3D animated, Pixar quality, heartwarming, expressive',
    sceneBlueprint: ['Character expression', 'animated backdrop', 'Pixar lighting', 'emotional moment'],
    cinematography: 'Animated movie framing, expressive character close-ups',
    enhancerKeywords: 'Disney Pixar style, 3D animated movie, CGI character, Pixar quality, heartwarming',
    negativePrompt: 'uncanny valley, poor 3D quality, flat lighting, lifeless expression',
    outputPackage: ['master prompt', 'character variants', 'scene options']
  },
  'electricity': {
    coreUseCase: 'Lightning effects',
    uiDescription: 'Add electric shock and lightning effects to images.',
    promptGoal: 'Generate dramatic electrical energy effects.',
    visualStyle: 'Electric, energetic, high-voltage, dramatic',
    sceneBlueprint: ['Subject pose', 'lightning origin', 'electric arcs', 'energy glow'],
    cinematography: 'Dramatic lighting angles, energy capture',
    enhancerKeywords: 'electricity effect, lightning bolt, high voltage, electric energy, dramatic shock',
    negativePrompt: 'no energy, flat lighting, static, dull effect',
    outputPackage: ['master prompt', 'lightning variants', 'intensity options']
  },
  'face-swap': {
    coreUseCase: 'Face swap technology',
    uiDescription: 'Create realistic AI face swap results.',
    promptGoal: 'Generate seamless face replacement.',
    visualStyle: 'Realistic, seamless, natural integration',
    sceneBlueprint: ['Source face', 'target integration', 'skin matching', 'natural blending'],
    cinematography: 'Matched lighting, angle alignment, natural integration',
    enhancerKeywords: 'face swap, realistic replacement, seamless integration, natural blending',
    negativePrompt: 'visible seams, color mismatch, poor integration, obvious swap',
    outputPackage: ['swap prompt', 'blend options', 'correction variants']
  },
  'fashion-stride': {
    coreUseCase: 'Runway animation',
    uiDescription: 'Create fashion runway walk animations.',
    promptGoal: 'Generate stylish fashion model walk sequences.',
    visualStyle: 'Fashion, runway, elegant, dynamic movement',
    sceneBlueprint: ['Model pose', 'runway path', 'clothing flow', 'confident stride'],
    cinematography: 'Runway perspective, dynamic movement capture',
    enhancerKeywords: 'fashion stride, runway walk, model movement, elegant motion',
    negativePrompt: 'stiff movement, poor pose, unnatural stride, static composition',
    outputPackage: ['walk prompt', 'pose variants', 'speed options']
  },
  'film-noir': {
    coreUseCase: 'Film noir style',
    uiDescription: 'Create classic black & white detective cinema aesthetics.',
    promptGoal: 'Generate moody, dramatic noir-style images with high contrast.',
    visualStyle: 'Black & white, high contrast, dramatic shadows, 1940s cinema',
    sceneBlueprint: ['Dramatic shadows', 'femme fatale lighting', 'rain-soaked streets', 'mystery atmosphere'],
    cinematography: 'Dramatic low-key lighting, deep shadows, venetian blind patterns',
    enhancerKeywords: 'film noir style, classic black and white, noir cinema, dramatic shadows, high contrast',
    negativePrompt: 'color, flat lighting, modern style, cheerful mood',
    outputPackage: ['master prompt', 'scene variants', 'character lighting options']
  },
  'fire-breath': {
    coreUseCase: 'Fire breath effect',
    uiDescription: 'Create dragon-style fire breath effects.',
    promptGoal: 'Generate dramatic fire-breathing moments.',
    visualStyle: 'Fiery, dramatic, dragon-like, powerful',
    sceneBlueprint: ['Character pose', 'fire origin', 'flame expansion', 'heat distortion'],
    cinematography: 'Dramatic profile shots, fire detail capture',
    enhancerKeywords: 'fire breath, dragon fire, dramatic flame, powerful fire effect',
    negativePrompt: 'weak flame, no heat, poor fire quality, static pose',
    outputPackage: ['master prompt', 'flame variants', 'intensity options']
  },
  'gender-swap': {
    coreUseCase: 'Gender transformation',
    uiDescription: 'Create AI-powered gender transformation.',
    promptGoal: 'Generate realistic gender-swap transformations.',
    visualStyle: 'Realistic, natural, transformed features',
    sceneBlueprint: ['Original pose', 'feature transformation', 'natural result', 'preserved identity'],
    cinematography: 'Consistent framing, natural lighting match',
    enhancerKeywords: 'gender swap, realistic transformation, natural features, preserved identity',
    negativePrompt: 'uncanny valley, poor transformation, distorted features, unnatural result',
    outputPackage: ['transform prompt', 'feature variants', 'style options']
  },
  'ghibli-style': {
    coreUseCase: 'Ghibli-style art',
    uiDescription: 'Transform images into magical Studio Ghibli-inspired illustrations.',
    promptGoal: 'Create whimsical, magical Ghibli-style art with lush nature and soft colors.',
    visualStyle: 'Whimsical, magical realism, lush nature, soft colors, Japanese anime',
    sceneBlueprint: ['Character focus', 'nature elements', 'magical atmosphere', 'soft color palette'],
    cinematography: 'Gentle, storybook framing with natural movement',
    enhancerKeywords: 'Studio Ghibli style, Hayao Miyazaki aesthetic, hand-drawn animation, whimsical, magical realism',
    negativePrompt: 'harsh lighting, industrial feel, dark mood, poor character design',
    outputPackage: ['master prompt', 'scene variants', 'character options']
  },
  'glamour-portrait': {
    coreUseCase: 'Glamour photography',
    uiDescription: 'Create Hollywood glamour photo enhancements.',
    promptGoal: 'Generate stunning red-carpet ready portraits.',
    visualStyle: 'Glamorous, Hollywood, red carpet, polished',
    sceneBlueprint: ['Portrait pose', 'dramatic lighting', 'glamour styling', 'premium finish'],
    cinematography: 'Hollywood portrait angles, flattering lighting, glamour shots style',
    enhancerKeywords: 'glamour portrait, Hollywood glamour, red carpet style, stunning portrait',
    negativePrompt: 'flat lighting, poor skin, unflattering angles, amateur quality',
    outputPackage: ['portrait prompt', 'glamour variants', 'lighting options']
  },
  'gta-loading-screen': {
    coreUseCase: 'GTA-style art',
    uiDescription: 'Create Rockstar Games satirical illustration style artwork.',
    promptGoal: 'Generate stylized GTA V loading screen art with satirical edge.',
    visualStyle: 'Satirical, stylized, Rockstar Games aesthetic, bold outlines',
    sceneBlueprint: ['Character pose', 'city backdrop', 'satirical style', 'Rockstar aesthetic'],
    cinematography: 'Bold character framing with stylized digital painting aesthetic',
    enhancerKeywords: 'GTA V loading screen art, satirical illustration, bold outlines, stylized digital painting',
    negativePrompt: 'realistic photo, flat style, poor character design, generic backdrop',
    outputPackage: ['master prompt', 'character variants', 'scene options']
  },
  'lego-style': {
    coreUseCase: 'Lego-style renders',
    uiDescription: 'Transform everything into awesome Lego form.',
    promptGoal: 'Create realistic Lego brick-built versions of any subject.',
    visualStyle: 'Plastic bricks, Lego aesthetic, colorful, toy-like',
    sceneBlueprint: ['Lego figure', 'brick-built environment', 'plastic material', 'playful composition'],
    cinematography: 'Toy photography style, macro-like detail',
    enhancerKeywords: 'Lego style, plastic brick aesthetic, toy photography, colorful construction',
    negativePrompt: 'realistic material, non-brick elements, poor construction, dull colors',
    outputPackage: ['master prompt', 'build variants', 'scene options']
  },
  'magazine-cover': {
    coreUseCase: 'Magazine cover design',
    uiDescription: 'Create high-fashion magazine cover aesthetics.',
    promptGoal: 'Generate elegant, editorial magazine cover compositions.',
    visualStyle: 'Editorial, high-fashion, sophisticated, Vogue aesthetic',
    sceneBlueprint: ['Fashion portrait', 'masthead space', 'cover lines area', 'editorial styling'],
    cinematography: 'Editorial portrait framing, fashion photography style',
    enhancerKeywords: 'high fashion magazine cover, editorial photography, Vogue aesthetic, luxury fashion',
    negativePrompt: 'amateur photography, cluttered layout, poor typography space, casual style',
    outputPackage: ['master prompt', 'cover variants', 'layout options']
  },
  'movie-poster': {
    coreUseCase: 'Movie poster design',
    uiDescription: 'Create cinematic theatrical movie poster designs.',
    promptGoal: 'Generate epic movie poster compositions with dramatic lighting.',
    visualStyle: 'Cinematic, dramatic, theatrical, high-impact',
    sceneBlueprint: ['Hero character', 'dramatic backdrop', 'title space', 'cast credits area'],
    cinematography: 'Epic wide shots, dramatic character poses, theatrical composition',
    enhancerKeywords: 'cinematic movie poster, dramatic lighting, epic composition, theatrical release style',
    negativePrompt: 'amateur layout, cluttered design, poor hierarchy, flat composition',
    outputPackage: ['master prompt', 'poster variants', 'title layouts']
  },
  'pixel-art': {
    coreUseCase: 'Retro pixel art',
    uiDescription: 'Create nostalgic 16-bit pixel art from photos.',
    promptGoal: 'Generate authentic retro game-style pixel art.',
    visualStyle: 'Retro, 16-bit, chiptune aesthetic, NES/SNES era',
    sceneBlueprint: ['Pixel character', 'retro background', 'limited palette', 'game-style composition'],
    cinematography: 'Classic game perspective, side-scroll or top-down style',
    enhancerKeywords: 'pixel art style, 16-bit retro game, chiptune aesthetic, NES SNES era, pixelated',
    negativePrompt: 'smooth gradients, photorealistic, anti-aliasing, modern style',
    outputPackage: ['master prompt', 'animation frames', 'sprite sheets']
  },
  'product-hero': {
    coreUseCase: 'Product photography',
    uiDescription: 'Create studio-quality product hero shots.',
    promptGoal: 'Generate premium product photography with perfect lighting.',
    visualStyle: 'Clean, commercial, premium, studio-lit',
    sceneBlueprint: ['Product center', 'gradient backdrop', 'rim lighting', 'reflection surface'],
    cinematography: 'Product photography angles, macro detail, clean backgrounds',
    enhancerKeywords: 'product hero shot, studio product photography, commercial quality, premium lighting',
    negativePrompt: 'cluttered background, poor lighting, amateur quality, distracting elements',
    outputPackage: ['master prompt', 'angle variants', 'background options']
  },
  'product-photography': {
    coreUseCase: 'Commercial product photos',
    uiDescription: 'Create professional commercial product images.',
    promptGoal: 'Generate e-commerce ready product photography.',
    visualStyle: 'Professional, clean, commercial, high-quality',
    sceneBlueprint: ['Product focus', 'clean background', 'even lighting', 'detail showcase'],
    cinematography: 'Commercial product angles, even illumination, detail capture',
    enhancerKeywords: 'product photography, commercial quality, e-commerce ready, professional lighting',
    negativePrompt: 'harsh shadows, cluttered, amateur, poor color accuracy',
    outputPackage: ['master prompt', 'style variants', 'background options']
  },
  'product-placement': {
    coreUseCase: 'Lifestyle product shots',
    uiDescription: 'Create natural lifestyle product placement imagery.',
    promptGoal: 'Generate authentic product-in-context lifestyle photos.',
    visualStyle: 'Natural, lifestyle, contextual, authentic',
    sceneBlueprint: ['Product in scene', 'lifestyle context', 'natural usage', 'ambient lighting'],
    cinematography: 'Lifestyle photography, natural angles, contextual framing',
    enhancerKeywords: 'product placement, lifestyle photography, natural context, authentic setting',
    negativePrompt: 'staged, artificial, poor integration, unnatural placement',
    outputPackage: ['master prompt', 'scene variants', 'context options']
  },
  'squid-game': {
    coreUseCase: 'Squid Game style',
    uiDescription: 'Create Korean drama survival game aesthetics.',
    promptGoal: 'Generate Squid Game-inspired dramatic visuals.',
    visualStyle: 'Minimalist, high-contrast, survival game, Korean drama',
    sceneBlueprint: ['Game arena', 'masked figures', 'tension lighting', 'geometric patterns'],
    cinematography: 'Clean, stark framing with dramatic tension',
    enhancerKeywords: 'Squid Game style, Korean drama, survival game aesthetic, minimalist tension',
    negativePrompt: 'colorful, playful, non-geometric, soft mood',
    outputPackage: ['master prompt', 'scene variants', 'character options']
  },
  'superhero-transform': {
    coreUseCase: 'Superhero transformations',
    uiDescription: 'Create epic superhero transformation sequences.',
    promptGoal: 'Generate dramatic superhero power-up moments.',
    visualStyle: 'Epic, powerful, comic-book hero, Marvel/DC aesthetic',
    sceneBlueprint: ['Hero pose', 'power burst', 'dramatic backdrop', 'energy effects'],
    cinematography: 'Heroic low angles, dynamic action framing, dramatic lighting',
    enhancerKeywords: 'superhero transformation, epic power-up, comic book style, Marvel DC aesthetic',
    negativePrompt: 'weak pose, no energy, flat lighting, static composition',
    outputPackage: ['master prompt', 'power variants', 'pose options']
  },
  'tornado': {
    coreUseCase: 'Tornado VFX',
    uiDescription: 'Create devastating tornado VFX scenes.',
    promptGoal: 'Generate dramatic tornado destruction sequences.',
    visualStyle: 'Devastating, dramatic, storm, destruction',
    sceneBlueprint: ['Storm formation', 'funnel development', 'debris field', 'destruction path'],
    cinematography: 'Wide storm shots, dramatic sky, destruction detail',
    enhancerKeywords: 'tornado VFX, storm destruction, dramatic funnel, devastating wind',
    negativePrompt: 'weak storm, no debris, poor formation, unrealistic physics',
    outputPackage: ['master prompt', 'storm variants', 'intensity options']
  },
  'unboxing-scene': {
    coreUseCase: 'Unboxing videos',
    uiDescription: 'Create dramatic product unboxing reveal moments.',
    promptGoal: 'Generate exciting unboxing anticipation and reveal.',
    visualStyle: 'Anticipation, reveal-focused, premium packaging, satisfying',
    sceneBlueprint: ['Box approach', 'opening moment', 'product reveal', 'satisfaction beat'],
    cinematography: 'Close-up anticipation shots, reveal angles, detail capture',
    enhancerKeywords: 'unboxing scene, product reveal, premium packaging, anticipation moment',
    negativePrompt: 'boring reveal, poor packaging, no anticipation, flat presentation',
    outputPackage: ['master prompt', 'reveal variants', 'angle options']
  },
  'vhs-retro': {
    coreUseCase: 'VHS retro effects',
    uiDescription: 'Apply analog VHS tape effects with scan lines and tracking errors.',
    promptGoal: 'Create authentic 80s VHS home video aesthetic.',
    visualStyle: 'Analog, lo-fi, 80s nostalgia, tracking errors, scan lines',
    sceneBlueprint: ['VHS grain overlay', 'tracking errors', 'color bleed', 'analog warmth'],
    cinematography: 'Home video framing, shaky handheld feel',
    enhancerKeywords: 'VHS retro style, analog video effect, 80s aesthetic, scan lines, tracking errors, vintage',
    negativePrompt: 'clean digital, high resolution, perfect color, modern look',
    outputPackage: ['master prompt', 'effect variants', 'intensity options']
  },
  'younger-self': {
    coreUseCase: 'Youth transformation',
    uiDescription: 'Travel back in time with a younger selfie.',
    promptGoal: 'Generate realistic younger versions of subjects.',
    visualStyle: 'Youthful, nostalgic, natural, preserved identity',
    sceneBlueprint: ['Base face', 'youth features', 'skin smoothing', 'natural result'],
    cinematography: 'Portrait framing, soft lighting',
    enhancerKeywords: 'younger self, youth transformation, natural rejuvenation, preserved identity',
    negativePrompt: 'unrealistic youth, distorted features, uncanny valley, identity loss',
    outputPackage: ['youth prompt', 'age variants', 'style options']
  },
  'restaurant-brand-film': {
    coreUseCase: 'Restaurant cinematic commercial film',
    uiDescription: 'flagship restaurant brand piece for premium positioning and reservations. Built for restaurant brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style restaurant video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Location intro', 'Food hero details', 'Guest dining moment', 'Brand reveal'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'restaurant cinematic commercial film, premium restaurant visuals, premium composition, restaurant brand atmosphere',
    negativePrompt: 'fast food look, chain restaurant, cluttered frame, poor lighting',
    outputPackage: ['master prompt', 'scene prompts', 'restaurant reveal CTA']
  },

  'restaurant-process-doc': {
    coreUseCase: 'Restaurant documentary style film',
    uiDescription: 'craft-focused behind-the-scenes film about drinks, service, and process. Built for restaurant brands seeking premium video.',
    promptGoal: 'Create a documentary style style restaurant video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Context', 'Pouring process', 'Artisan detail', 'Guest experience', 'Grounded close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'restaurant documentary style film, premium restaurant visuals, documentary realism composition, restaurant brand atmosphere',
    negativePrompt: 'fast food look, chain restaurant, cluttered frame, poor lighting',
    outputPackage: ['master prompt', 'scene prompts', 'restaurant reveal CTA']
  },

  'restaurant-menu-showcase': {
    coreUseCase: 'Restaurant promo film',
    uiDescription: 'hero showcase for a signature dish or chef special. Built for restaurant brands seeking premium video.',
    promptGoal: 'Create a promo style restaurant video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Opener', 'Plate reveal', 'Ingredient detail', 'Guest reaction', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'restaurant promo film, premium restaurant visuals, conversion-aware composition, restaurant brand atmosphere',
    negativePrompt: 'fast food look, chain restaurant, cluttered frame, poor lighting',
    outputPackage: ['master prompt', 'scene prompts', 'restaurant reveal CTA']
  },

  'restaurant-craft-story': {
    coreUseCase: 'Restaurant cinematic short film',
    uiDescription: 'emotional chef/craft narrative for a premium restaurant identity. Built for restaurant brands seeking premium video.',
    promptGoal: 'Create a cinematic short style restaurant video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Hook', 'Kitchen setup', 'Craft in motion', 'Emotional payoff', 'Reveal'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'restaurant cinematic short film, premium restaurant visuals, filmic composition, restaurant brand atmosphere',
    negativePrompt: 'fast food look, chain restaurant, cluttered frame, poor lighting',
    outputPackage: ['master prompt', 'scene prompts', 'restaurant reveal CTA']
  },

  'restaurant-offer-promo': {
    coreUseCase: 'Restaurant promo film',
    uiDescription: 'offer-driven promo for reservations, specials, or a limited seating push. Built for restaurant brands seeking premium video.',
    promptGoal: 'Create a promo style restaurant video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Atmosphere', 'Offer intro', 'Value visuals', 'Urgency cue', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'restaurant promo film, premium restaurant visuals, conversion-aware composition, restaurant brand atmosphere',
    negativePrompt: 'fast food look, chain restaurant, cluttered frame, poor lighting',
    outputPackage: ['master prompt', 'scene prompts', 'restaurant reveal CTA']
  },

  'restaurant-launch-trailer': {
    coreUseCase: 'Restaurant dramatic trailer film',
    uiDescription: 'high-drama launch teaser for a grand opening or new concept. Built for restaurant brands seeking premium video.',
    promptGoal: 'Create a dramatic trailer style restaurant video that drives engagement and trust.',
    visualStyle: 'High-impact, moody contrast, dramatic motion, big reveals',
    sceneBlueprint: ['Tension hook', 'Build anticipation', 'Partial reveal', 'Climax', 'Opening CTA'],
    cinematography: 'High-impact pacing, moody contrast, reveal shots, dramatic camera motion',
    enhancerKeywords: 'restaurant dramatic trailer film, premium restaurant visuals, high-impact composition, restaurant brand atmosphere',
    negativePrompt: 'fast food look, chain restaurant, cluttered frame, poor lighting',
    outputPackage: ['master prompt', 'scene prompts', 'restaurant reveal CTA']
  },

  'restaurant-experience-video': {
    coreUseCase: 'Restaurant cinematic commercial film',
    uiDescription: 'guest-experience video for homepage, ads, or landing pages. Built for restaurant brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style restaurant video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Table setup', 'Service moments', 'Guest enjoyment', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'restaurant cinematic commercial film, premium restaurant visuals, premium composition, restaurant brand atmosphere',
    negativePrompt: 'fast food look, chain restaurant, cluttered frame, poor lighting',
    outputPackage: ['master prompt', 'scene prompts', 'restaurant reveal CTA']
  },

  'restaurant-evening-recap': {
    coreUseCase: 'Restaurant documentary style film',
    uiDescription: 'nightlife-style recap piece showing atmosphere after dark. Built for restaurant brands seeking premium video.',
    promptGoal: 'Create a documentary style style restaurant video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['City mood', 'Restaurant energy', 'Social moments', 'Food/drink beats', 'Closing vibe'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'restaurant documentary style film, premium restaurant visuals, documentary realism composition, restaurant brand atmosphere',
    negativePrompt: 'fast food look, chain restaurant, cluttered frame, poor lighting',
    outputPackage: ['master prompt', 'scene prompts', 'restaurant reveal CTA']
  },

  'restaurant-social-reel': {
    coreUseCase: 'Restaurant promo film',
    uiDescription: 'vertical social reel for food, drink, and reservation hooks. Built for restaurant brands seeking premium video.',
    promptGoal: 'Create a promo style restaurant video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Quick details', 'Appetite moment', 'Offer or CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'restaurant promo film, premium restaurant visuals, conversion-aware composition, restaurant brand atmosphere',
    negativePrompt: 'fast food look, chain restaurant, cluttered frame, poor lighting',
    outputPackage: ['master prompt', 'scene prompts', 'restaurant reveal CTA']
  },

  'restaurant-feature-piece': {
    coreUseCase: 'Restaurant cinematic short film',
    uiDescription: 'premium hero piece centered on one signature menu experience. Built for restaurant brands seeking premium video.',
    promptGoal: 'Create a cinematic short style restaurant video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Intro', 'Feature setup', 'Detail sequence', 'Guest payoff', 'Brand close'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'restaurant cinematic short film, premium restaurant visuals, filmic composition, restaurant brand atmosphere',
    negativePrompt: 'fast food look, chain restaurant, cluttered frame, poor lighting',
    outputPackage: ['master prompt', 'scene prompts', 'restaurant reveal CTA']
  },

  'medspa-brand-film': {
    coreUseCase: 'Med-spa cinematic commercial film',
    uiDescription: 'luxury med spa flagship film for prestige branding. Built for med-spa brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style med-spa video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Clinic intro', 'Treatment beauty details', 'Client confidence moment', 'Brand reveal'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'med-spa cinematic commercial film, premium med-spa visuals, premium composition, med-spa brand atmosphere',
    negativePrompt: 'cheap clinic look, harsh clinical light, cluttered counter, poor skin tone',
    outputPackage: ['master prompt', 'scene prompts', 'med-spa reveal CTA']
  },

  'medspa-service-video': {
    coreUseCase: 'Med-spa cinematic commercial film',
    uiDescription: 'clean commercial video showing the treatment environment and experience. Built for med-spa brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style med-spa video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Opener', 'Room and tools', 'Treatment flow', 'Calm client moment', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'med-spa cinematic commercial film, premium med-spa visuals, premium composition, med-spa brand atmosphere',
    negativePrompt: 'cheap clinic look, harsh clinical light, cluttered counter, poor skin tone',
    outputPackage: ['master prompt', 'scene prompts', 'med-spa reveal CTA']
  },

  'medspa-transformation-story': {
    coreUseCase: 'Med-spa cinematic short film',
    uiDescription: 'emotional transformation piece centered on confidence and results. Built for med-spa brands seeking premium video.',
    promptGoal: 'Create a cinematic short style med-spa video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Before feeling', 'Treatment path', 'Emotional shift', 'After reveal', 'Brand close'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'med-spa cinematic short film, premium med-spa visuals, filmic composition, med-spa brand atmosphere',
    negativePrompt: 'cheap clinic look, harsh clinical light, cluttered counter, poor skin tone',
    outputPackage: ['master prompt', 'scene prompts', 'med-spa reveal CTA']
  },

  'medspa-result-reveal': {
    coreUseCase: 'Med-spa promo film',
    uiDescription: 'short result-reveal promo for before/after campaigns. Built for med-spa brands seeking premium video.',
    promptGoal: 'Create a promo style med-spa video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Treatment cue', 'Reveal', 'Confidence payoff', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'med-spa promo film, premium med-spa visuals, conversion-aware composition, med-spa brand atmosphere',
    negativePrompt: 'cheap clinic look, harsh clinical light, cluttered counter, poor skin tone',
    outputPackage: ['master prompt', 'scene prompts', 'med-spa reveal CTA']
  },

  'medspa-offer-promo': {
    coreUseCase: 'Med-spa promo film',
    uiDescription: 'conversion-focused promo for a package, treatment, or booking offer. Built for med-spa brands seeking premium video.',
    promptGoal: 'Create a promo style med-spa video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Atmosphere', 'Offer intro', 'Benefit visuals', 'Urgency or exclusivity', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'med-spa promo film, premium med-spa visuals, conversion-aware composition, med-spa brand atmosphere',
    negativePrompt: 'cheap clinic look, harsh clinical light, cluttered counter, poor skin tone',
    outputPackage: ['master prompt', 'scene prompts', 'med-spa reveal CTA']
  },

  'medspa-founder-doc': {
    coreUseCase: 'Med-spa founder story film',
    uiDescription: 'founder or expert authority piece for trust and credibility. Built for med-spa brands seeking premium video.',
    promptGoal: 'Create a founder story style med-spa video that drives engagement and trust.',
    visualStyle: 'Portrait-led, emotional, authoritative, warm practical light',
    sceneBlueprint: ['Origin', 'Expertise', 'Mission', 'Treatment proof', 'CTA'],
    cinematography: 'Portrait-led premium close-ups, emotional pacing, authority framing, warm practical light',
    enhancerKeywords: 'med-spa founder story film, premium med-spa visuals, portrait-led composition, med-spa brand atmosphere',
    negativePrompt: 'cheap clinic look, harsh clinical light, cluttered counter, poor skin tone',
    outputPackage: ['master prompt', 'scene prompts', 'med-spa reveal CTA']
  },

  'medspa-testimonial': {
    coreUseCase: 'Med-spa testimonial film',
    uiDescription: 'client proof story about confidence, treatment, and visible results. Built for med-spa brands seeking premium video.',
    promptGoal: 'Create a testimonial style med-spa video that drives engagement and trust.',
    visualStyle: 'Grounded realism, real energy, supportive, emotionally proof',
    sceneBlueprint: ['Concern', 'Treatment decision', 'Process', 'Glow result', 'Recommendation'],
    cinematography: 'Real customer energy, supportive b-roll, emotional proof moments',
    enhancerKeywords: 'med-spa testimonial film, premium med-spa visuals, grounded realism composition, med-spa brand atmosphere',
    negativePrompt: 'cheap clinic look, harsh clinical light, cluttered counter, poor skin tone',
    outputPackage: ['master prompt', 'scene prompts', 'med-spa reveal CTA']
  },

  'medspa-social-reel': {
    coreUseCase: 'Med-spa promo film',
    uiDescription: 'vertical reel for beauty hooks, offers, and visual transformations. Built for med-spa brands seeking premium video.',
    promptGoal: 'Create a promo style med-spa video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Treatment detail', 'Glow moment', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'med-spa promo film, premium med-spa visuals, conversion-aware composition, med-spa brand atmosphere',
    negativePrompt: 'cheap clinic look, harsh clinical light, cluttered counter, poor skin tone',
    outputPackage: ['master prompt', 'scene prompts', 'med-spa reveal CTA']
  },

  'medspa-clinic-piece': {
    coreUseCase: 'Med-spa documentary style film',
    uiDescription: 'atmosphere-led clinic film centered on environment and client experience. Built for med-spa brands seeking premium video.',
    promptGoal: 'Create a documentary style style med-spa video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Clinic mood', 'Process detail', 'Calm transformation', 'Interior beauty close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'med-spa documentary style film, premium med-spa visuals, documentary realism composition, med-spa brand atmosphere',
    negativePrompt: 'cheap clinic look, harsh clinical light, cluttered counter, poor skin tone',
    outputPackage: ['master prompt', 'scene prompts', 'med-spa reveal CTA']
  },

  'medspa-luxury-offer': {
    coreUseCase: 'Med-spa cinematic commercial film',
    uiDescription: 'commercial-style premium offer video for campaigns or landing pages. Built for med-spa brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style med-spa video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Opener', 'Package reveal', 'Experience detail', 'Aspirational result', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'med-spa cinematic commercial film, premium med-spa visuals, premium composition, med-spa brand atmosphere',
    negativePrompt: 'cheap clinic look, harsh clinical light, cluttered counter, poor skin tone',
    outputPackage: ['master prompt', 'scene prompts', 'med-spa reveal CTA']
  },

  'salon-brand-film': {
    coreUseCase: 'Salon cinematic commercial film',
    uiDescription: 'flagship salon brand film for premium positioning and trust. Built for salon brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style salon video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Space or brand intro', 'Hero details', 'Human value moment', 'Brand reveal / CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'salon cinematic commercial film, premium salon visuals, premium composition, salon brand atmosphere',
    negativePrompt: 'messy station, poor lighting, cluttered frame, amateur tools',
    outputPackage: ['master prompt', 'scene prompts', 'salon reveal CTA']
  },

  'salon-process-doc': {
    coreUseCase: 'Salon documentary style film',
    uiDescription: 'behind-the-scenes documentary about the salon process and craft. Built for salon brands seeking premium video.',
    promptGoal: 'Create a documentary style style salon video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Context', 'Real-world process', 'Human detail', 'Insight', 'Grounded close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'salon documentary style film, premium salon visuals, documentary realism composition, salon brand atmosphere',
    negativePrompt: 'messy station, poor lighting, cluttered frame, amateur tools',
    outputPackage: ['master prompt', 'scene prompts', 'salon reveal CTA']
  },

  'salon-transformation-story': {
    coreUseCase: 'Salon cinematic short film',
    uiDescription: 'emotional transformation piece centered on results and confidence. Built for salon brands seeking premium video.',
    promptGoal: 'Create a cinematic short style salon video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Before feeling', 'Process path', 'Emotional shift', 'After reveal', 'Brand close'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'salon cinematic short film, premium salon visuals, filmic composition, salon brand atmosphere',
    negativePrompt: 'messy station, poor lighting, cluttered frame, amateur tools',
    outputPackage: ['master prompt', 'scene prompts', 'salon reveal CTA']
  },

  'salon-testimonial': {
    coreUseCase: 'Salon testimonial film',
    uiDescription: 'client proof story about experience and visible results. Built for salon brands seeking premium video.',
    promptGoal: 'Create a testimonial style salon video that drives engagement and trust.',
    visualStyle: 'Grounded realism, real energy, supportive, emotionally proof',
    sceneBlueprint: ['Problem', 'Frustration', 'Solution', 'Transformation', 'Trust-building close'],
    cinematography: 'Real customer energy, supportive b-roll, emotional proof moments',
    enhancerKeywords: 'salon testimonial film, premium salon visuals, grounded realism composition, salon brand atmosphere',
    negativePrompt: 'messy station, poor lighting, cluttered frame, amateur tools',
    outputPackage: ['master prompt', 'scene prompts', 'salon reveal CTA']
  },

  'salon-founder-doc': {
    coreUseCase: 'Salon founder story film',
    uiDescription: 'founder or expert authority piece for trust and credibility. Built for salon brands seeking premium video.',
    promptGoal: 'Create a founder story style salon video that drives engagement and trust.',
    visualStyle: 'Portrait-led, emotional, authoritative, warm practical light',
    sceneBlueprint: ['Origin', 'Struggle', 'Mission', 'Breakthrough', 'Future / CTA'],
    cinematography: 'Portrait-led premium close-ups, emotional pacing, authority framing, warm practical light',
    enhancerKeywords: 'salon founder story film, premium salon visuals, portrait-led composition, salon brand atmosphere',
    negativePrompt: 'messy station, poor lighting, cluttered frame, amateur tools',
    outputPackage: ['master prompt', 'scene prompts', 'salon reveal CTA']
  },

  'salon-offer-promo': {
    coreUseCase: 'Salon promo film',
    uiDescription: 'conversion-focused promo for a package, service, or booking offer. Built for salon brands seeking premium video.',
    promptGoal: 'Create a promo style salon video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Atmosphere', 'Offer intro', 'Benefit visuals', 'Urgency or exclusivity', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'salon promo film, premium salon visuals, conversion-aware composition, salon brand atmosphere',
    negativePrompt: 'messy station, poor lighting, cluttered frame, amateur tools',
    outputPackage: ['master prompt', 'scene prompts', 'salon reveal CTA']
  },

  'salon-launch-trailer': {
    coreUseCase: 'Salon dramatic trailer film',
    uiDescription: 'high-drama launch teaser for a grand opening or new concept. Built for salon brands seeking premium video.',
    promptGoal: 'Create a dramatic trailer style salon video that drives engagement and trust.',
    visualStyle: 'High-impact, moody contrast, dramatic motion, big reveals',
    sceneBlueprint: ['Tension hook', 'Escalation', 'Partial reveal', 'Climax', 'Title card / CTA'],
    cinematography: 'High-impact pacing, moody contrast, reveal shots, dramatic camera motion',
    enhancerKeywords: 'salon dramatic trailer film, premium salon visuals, high-impact composition, salon brand atmosphere',
    negativePrompt: 'messy station, poor lighting, cluttered frame, amateur tools',
    outputPackage: ['master prompt', 'scene prompts', 'salon reveal CTA']
  },

  'salon-social-reel': {
    coreUseCase: 'Salon promo film',
    uiDescription: 'vertical social reel for hooks, offers, and visual moments. Built for salon brands seeking premium video.',
    promptGoal: 'Create a promo style salon video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Quick details', 'Moment', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'salon promo film, premium salon visuals, conversion-aware composition, salon brand atmosphere',
    negativePrompt: 'messy station, poor lighting, cluttered frame, amateur tools',
    outputPackage: ['master prompt', 'scene prompts', 'salon reveal CTA']
  },

  'salon-atmosphere-piece': {
    coreUseCase: 'Salon documentary style film',
    uiDescription: 'atmosphere-led film centered on environment and client experience. Built for salon brands seeking premium video.',
    promptGoal: 'Create a documentary style style salon video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Mood', 'Process detail', 'Calm moment', 'Interior close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'salon documentary style film, premium salon visuals, documentary realism composition, salon brand atmosphere',
    negativePrompt: 'messy station, poor lighting, cluttered frame, amateur tools',
    outputPackage: ['master prompt', 'scene prompts', 'salon reveal CTA']
  },

  'salon-luxury-offer': {
    coreUseCase: 'Salon cinematic commercial film',
    uiDescription: 'commercial-style premium offer video for campaigns or landing pages. Built for salon brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style salon video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Opener', 'Package reveal', 'Experience detail', 'Aspirational result', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'salon cinematic commercial film, premium salon visuals, premium composition, salon brand atmosphere',
    negativePrompt: 'messy station, poor lighting, cluttered frame, amateur tools',
    outputPackage: ['master prompt', 'scene prompts', 'salon reveal CTA']
  },

  'fitness-brand-film': {
    coreUseCase: 'Fitness cinematic commercial film',
    uiDescription: 'flagship fitness brand film for premium positioning and trust. Built for fitness brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style fitness video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Space or brand intro', 'Hero details', 'Human value moment', 'Brand reveal / CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'fitness cinematic commercial film, premium fitness visuals, premium composition, fitness brand atmosphere',
    negativePrompt: 'static pose, poor gym lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'fitness reveal CTA']
  },

  'fitness-process-doc': {
    coreUseCase: 'Fitness documentary style film',
    uiDescription: 'behind-the-scenes documentary about the fitness process and craft. Built for fitness brands seeking premium video.',
    promptGoal: 'Create a documentary style style fitness video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Context', 'Real-world process', 'Human detail', 'Insight', 'Grounded close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'fitness documentary style film, premium fitness visuals, documentary realism composition, fitness brand atmosphere',
    negativePrompt: 'static pose, poor gym lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'fitness reveal CTA']
  },

  'fitness-transformation-story': {
    coreUseCase: 'Fitness cinematic short film',
    uiDescription: 'emotional transformation piece centered on results and confidence. Built for fitness brands seeking premium video.',
    promptGoal: 'Create a cinematic short style fitness video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Before feeling', 'Process path', 'Emotional shift', 'After reveal', 'Brand close'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'fitness cinematic short film, premium fitness visuals, filmic composition, fitness brand atmosphere',
    negativePrompt: 'static pose, poor gym lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'fitness reveal CTA']
  },

  'fitness-testimonial': {
    coreUseCase: 'Fitness testimonial film',
    uiDescription: 'client proof story about experience and visible results. Built for fitness brands seeking premium video.',
    promptGoal: 'Create a testimonial style fitness video that drives engagement and trust.',
    visualStyle: 'Grounded realism, real energy, supportive, emotionally proof',
    sceneBlueprint: ['Problem', 'Frustration', 'Solution', 'Transformation', 'Trust-building close'],
    cinematography: 'Real customer energy, supportive b-roll, emotional proof moments',
    enhancerKeywords: 'fitness testimonial film, premium fitness visuals, grounded realism composition, fitness brand atmosphere',
    negativePrompt: 'static pose, poor gym lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'fitness reveal CTA']
  },

  'fitness-founder-doc': {
    coreUseCase: 'Fitness founder story film',
    uiDescription: 'founder or expert authority piece for trust and credibility. Built for fitness brands seeking premium video.',
    promptGoal: 'Create a founder story style fitness video that drives engagement and trust.',
    visualStyle: 'Portrait-led, emotional, authoritative, warm practical light',
    sceneBlueprint: ['Origin', 'Struggle', 'Mission', 'Breakthrough', 'Future / CTA'],
    cinematography: 'Portrait-led premium close-ups, emotional pacing, authority framing, warm practical light',
    enhancerKeywords: 'fitness founder story film, premium fitness visuals, portrait-led composition, fitness brand atmosphere',
    negativePrompt: 'static pose, poor gym lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'fitness reveal CTA']
  },

  'fitness-offer-promo': {
    coreUseCase: 'Fitness promo film',
    uiDescription: 'conversion-focused promo for a package, service, or booking offer. Built for fitness brands seeking premium video.',
    promptGoal: 'Create a promo style fitness video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Atmosphere', 'Offer intro', 'Benefit visuals', 'Urgency or exclusivity', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'fitness promo film, premium fitness visuals, conversion-aware composition, fitness brand atmosphere',
    negativePrompt: 'static pose, poor gym lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'fitness reveal CTA']
  },

  'fitness-launch-trailer': {
    coreUseCase: 'Fitness dramatic trailer film',
    uiDescription: 'high-drama launch teaser for a grand opening or new concept. Built for fitness brands seeking premium video.',
    promptGoal: 'Create a dramatic trailer style fitness video that drives engagement and trust.',
    visualStyle: 'High-impact, moody contrast, dramatic motion, big reveals',
    sceneBlueprint: ['Tension hook', 'Escalation', 'Partial reveal', 'Climax', 'Title card / CTA'],
    cinematography: 'High-impact pacing, moody contrast, reveal shots, dramatic camera motion',
    enhancerKeywords: 'fitness dramatic trailer film, premium fitness visuals, high-impact composition, fitness brand atmosphere',
    negativePrompt: 'static pose, poor gym lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'fitness reveal CTA']
  },

  'fitness-social-reel': {
    coreUseCase: 'Fitness promo film',
    uiDescription: 'vertical social reel for hooks, offers, and visual moments. Built for fitness brands seeking premium video.',
    promptGoal: 'Create a promo style fitness video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Quick details', 'Moment', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'fitness promo film, premium fitness visuals, conversion-aware composition, fitness brand atmosphere',
    negativePrompt: 'static pose, poor gym lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'fitness reveal CTA']
  },

  'fitness-atmosphere-piece': {
    coreUseCase: 'Fitness documentary style film',
    uiDescription: 'atmosphere-led film centered on environment and client experience. Built for fitness brands seeking premium video.',
    promptGoal: 'Create a documentary style style fitness video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Mood', 'Process detail', 'Calm moment', 'Interior close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'fitness documentary style film, premium fitness visuals, documentary realism composition, fitness brand atmosphere',
    negativePrompt: 'static pose, poor gym lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'fitness reveal CTA']
  },

  'fitness-luxury-offer': {
    coreUseCase: 'Fitness cinematic commercial film',
    uiDescription: 'commercial-style premium offer video for campaigns or landing pages. Built for fitness brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style fitness video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Opener', 'Package reveal', 'Experience detail', 'Aspirational result', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'fitness cinematic commercial film, premium fitness visuals, premium composition, fitness brand atmosphere',
    negativePrompt: 'static pose, poor gym lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'fitness reveal CTA']
  },

  'real-estate-brand-film': {
    coreUseCase: 'Real-estate cinematic commercial film',
    uiDescription: 'flagship real-estate brand film for premium positioning and trust. Built for real-estate brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style real-estate video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Space or brand intro', 'Hero details', 'Human value moment', 'Brand reveal / CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'real-estate cinematic commercial film, premium real-estate visuals, premium composition, real-estate brand atmosphere',
    negativePrompt: 'cluttered room, poor lighting, bad angles, unstaged look',
    outputPackage: ['master prompt', 'scene prompts', 'real-estate reveal CTA']
  },

  'real-estate-process-doc': {
    coreUseCase: 'Real-estate documentary style film',
    uiDescription: 'behind-the-scenes documentary about the real-estate process and craft. Built for real-estate brands seeking premium video.',
    promptGoal: 'Create a documentary style style real-estate video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Context', 'Real-world process', 'Human detail', 'Insight', 'Grounded close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'real-estate documentary style film, premium real-estate visuals, documentary realism composition, real-estate brand atmosphere',
    negativePrompt: 'cluttered room, poor lighting, bad angles, unstaged look',
    outputPackage: ['master prompt', 'scene prompts', 'real-estate reveal CTA']
  },

  'real-estate-transformation-story': {
    coreUseCase: 'Real-estate cinematic short film',
    uiDescription: 'emotional transformation piece centered on results and confidence. Built for real-estate brands seeking premium video.',
    promptGoal: 'Create a cinematic short style real-estate video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Before feeling', 'Process path', 'Emotional shift', 'After reveal', 'Brand close'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'real-estate cinematic short film, premium real-estate visuals, filmic composition, real-estate brand atmosphere',
    negativePrompt: 'cluttered room, poor lighting, bad angles, unstaged look',
    outputPackage: ['master prompt', 'scene prompts', 'real-estate reveal CTA']
  },

  'real-estate-testimonial': {
    coreUseCase: 'Real-estate testimonial film',
    uiDescription: 'client proof story about experience and visible results. Built for real-estate brands seeking premium video.',
    promptGoal: 'Create a testimonial style real-estate video that drives engagement and trust.',
    visualStyle: 'Grounded realism, real energy, supportive, emotionally proof',
    sceneBlueprint: ['Problem', 'Frustration', 'Solution', 'Transformation', 'Trust-building close'],
    cinematography: 'Real customer energy, supportive b-roll, emotional proof moments',
    enhancerKeywords: 'real-estate testimonial film, premium real-estate visuals, grounded realism composition, real-estate brand atmosphere',
    negativePrompt: 'cluttered room, poor lighting, bad angles, unstaged look',
    outputPackage: ['master prompt', 'scene prompts', 'real-estate reveal CTA']
  },

  'real-estate-founder-doc': {
    coreUseCase: 'Real-estate founder story film',
    uiDescription: 'founder or expert authority piece for trust and credibility. Built for real-estate brands seeking premium video.',
    promptGoal: 'Create a founder story style real-estate video that drives engagement and trust.',
    visualStyle: 'Portrait-led, emotional, authoritative, warm practical light',
    sceneBlueprint: ['Origin', 'Struggle', 'Mission', 'Breakthrough', 'Future / CTA'],
    cinematography: 'Portrait-led premium close-ups, emotional pacing, authority framing, warm practical light',
    enhancerKeywords: 'real-estate founder story film, premium real-estate visuals, portrait-led composition, real-estate brand atmosphere',
    negativePrompt: 'cluttered room, poor lighting, bad angles, unstaged look',
    outputPackage: ['master prompt', 'scene prompts', 'real-estate reveal CTA']
  },

  'real-estate-offer-promo': {
    coreUseCase: 'Real-estate promo film',
    uiDescription: 'conversion-focused promo for a package, service, or booking offer. Built for real-estate brands seeking premium video.',
    promptGoal: 'Create a promo style real-estate video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Atmosphere', 'Offer intro', 'Benefit visuals', 'Urgency or exclusivity', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'real-estate promo film, premium real-estate visuals, conversion-aware composition, real-estate brand atmosphere',
    negativePrompt: 'cluttered room, poor lighting, bad angles, unstaged look',
    outputPackage: ['master prompt', 'scene prompts', 'real-estate reveal CTA']
  },

  'real-estate-launch-trailer': {
    coreUseCase: 'Real-estate dramatic trailer film',
    uiDescription: 'high-drama launch teaser for a grand opening or new concept. Built for real-estate brands seeking premium video.',
    promptGoal: 'Create a dramatic trailer style real-estate video that drives engagement and trust.',
    visualStyle: 'High-impact, moody contrast, dramatic motion, big reveals',
    sceneBlueprint: ['Tension hook', 'Escalation', 'Partial reveal', 'Climax', 'Title card / CTA'],
    cinematography: 'High-impact pacing, moody contrast, reveal shots, dramatic camera motion',
    enhancerKeywords: 'real-estate dramatic trailer film, premium real-estate visuals, high-impact composition, real-estate brand atmosphere',
    negativePrompt: 'cluttered room, poor lighting, bad angles, unstaged look',
    outputPackage: ['master prompt', 'scene prompts', 'real-estate reveal CTA']
  },

  'real-estate-social-reel': {
    coreUseCase: 'Real-estate promo film',
    uiDescription: 'vertical social reel for hooks, offers, and visual moments. Built for real-estate brands seeking premium video.',
    promptGoal: 'Create a promo style real-estate video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Quick details', 'Moment', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'real-estate promo film, premium real-estate visuals, conversion-aware composition, real-estate brand atmosphere',
    negativePrompt: 'cluttered room, poor lighting, bad angles, unstaged look',
    outputPackage: ['master prompt', 'scene prompts', 'real-estate reveal CTA']
  },

  'real-estate-atmosphere-piece': {
    coreUseCase: 'Real-estate documentary style film',
    uiDescription: 'atmosphere-led film centered on environment and client experience. Built for real-estate brands seeking premium video.',
    promptGoal: 'Create a documentary style style real-estate video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Mood', 'Process detail', 'Calm moment', 'Interior close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'real-estate documentary style film, premium real-estate visuals, documentary realism composition, real-estate brand atmosphere',
    negativePrompt: 'cluttered room, poor lighting, bad angles, unstaged look',
    outputPackage: ['master prompt', 'scene prompts', 'real-estate reveal CTA']
  },

  'real-estate-luxury-offer': {
    coreUseCase: 'Real-estate cinematic commercial film',
    uiDescription: 'commercial-style premium offer video for campaigns or landing pages. Built for real-estate brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style real-estate video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Opener', 'Package reveal', 'Experience detail', 'Aspirational result', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'real-estate cinematic commercial film, premium real-estate visuals, premium composition, real-estate brand atmosphere',
    negativePrompt: 'cluttered room, poor lighting, bad angles, unstaged look',
    outputPackage: ['master prompt', 'scene prompts', 'real-estate reveal CTA']
  },

  'dental-brand-film': {
    coreUseCase: 'Dental cinematic commercial film',
    uiDescription: 'flagship dental brand film for premium positioning and trust. Built for dental brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style dental video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Space or brand intro', 'Hero details', 'Human value moment', 'Brand reveal / CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'dental cinematic commercial film, premium dental visuals, premium composition, dental brand atmosphere',
    negativePrompt: 'clinical sterility, harsh light, cluttered frame, poor smile reveal',
    outputPackage: ['master prompt', 'scene prompts', 'dental reveal CTA']
  },

  'dental-process-doc': {
    coreUseCase: 'Dental documentary style film',
    uiDescription: 'behind-the-scenes documentary about the dental process and craft. Built for dental brands seeking premium video.',
    promptGoal: 'Create a documentary style style dental video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Context', 'Real-world process', 'Human detail', 'Insight', 'Grounded close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'dental documentary style film, premium dental visuals, documentary realism composition, dental brand atmosphere',
    negativePrompt: 'clinical sterility, harsh light, cluttered frame, poor smile reveal',
    outputPackage: ['master prompt', 'scene prompts', 'dental reveal CTA']
  },

  'dental-transformation-story': {
    coreUseCase: 'Dental cinematic short film',
    uiDescription: 'emotional transformation piece centered on results and confidence. Built for dental brands seeking premium video.',
    promptGoal: 'Create a cinematic short style dental video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Before feeling', 'Process path', 'Emotional shift', 'After reveal', 'Brand close'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'dental cinematic short film, premium dental visuals, filmic composition, dental brand atmosphere',
    negativePrompt: 'clinical sterility, harsh light, cluttered frame, poor smile reveal',
    outputPackage: ['master prompt', 'scene prompts', 'dental reveal CTA']
  },

  'dental-testimonial': {
    coreUseCase: 'Dental testimonial film',
    uiDescription: 'client proof story about experience and visible results. Built for dental brands seeking premium video.',
    promptGoal: 'Create a testimonial style dental video that drives engagement and trust.',
    visualStyle: 'Grounded realism, real energy, supportive, emotionally proof',
    sceneBlueprint: ['Problem', 'Frustration', 'Solution', 'Transformation', 'Trust-building close'],
    cinematography: 'Real customer energy, supportive b-roll, emotional proof moments',
    enhancerKeywords: 'dental testimonial film, premium dental visuals, grounded realism composition, dental brand atmosphere',
    negativePrompt: 'clinical sterility, harsh light, cluttered frame, poor smile reveal',
    outputPackage: ['master prompt', 'scene prompts', 'dental reveal CTA']
  },

  'dental-founder-doc': {
    coreUseCase: 'Dental founder story film',
    uiDescription: 'founder or expert authority piece for trust and credibility. Built for dental brands seeking premium video.',
    promptGoal: 'Create a founder story style dental video that drives engagement and trust.',
    visualStyle: 'Portrait-led, emotional, authoritative, warm practical light',
    sceneBlueprint: ['Origin', 'Struggle', 'Mission', 'Breakthrough', 'Future / CTA'],
    cinematography: 'Portrait-led premium close-ups, emotional pacing, authority framing, warm practical light',
    enhancerKeywords: 'dental founder story film, premium dental visuals, portrait-led composition, dental brand atmosphere',
    negativePrompt: 'clinical sterility, harsh light, cluttered frame, poor smile reveal',
    outputPackage: ['master prompt', 'scene prompts', 'dental reveal CTA']
  },

  'dental-offer-promo': {
    coreUseCase: 'Dental promo film',
    uiDescription: 'conversion-focused promo for a package, service, or booking offer. Built for dental brands seeking premium video.',
    promptGoal: 'Create a promo style dental video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Atmosphere', 'Offer intro', 'Benefit visuals', 'Urgency or exclusivity', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'dental promo film, premium dental visuals, conversion-aware composition, dental brand atmosphere',
    negativePrompt: 'clinical sterility, harsh light, cluttered frame, poor smile reveal',
    outputPackage: ['master prompt', 'scene prompts', 'dental reveal CTA']
  },

  'dental-launch-trailer': {
    coreUseCase: 'Dental dramatic trailer film',
    uiDescription: 'high-drama launch teaser for a grand opening or new concept. Built for dental brands seeking premium video.',
    promptGoal: 'Create a dramatic trailer style dental video that drives engagement and trust.',
    visualStyle: 'High-impact, moody contrast, dramatic motion, big reveals',
    sceneBlueprint: ['Tension hook', 'Escalation', 'Partial reveal', 'Climax', 'Title card / CTA'],
    cinematography: 'High-impact pacing, moody contrast, reveal shots, dramatic camera motion',
    enhancerKeywords: 'dental dramatic trailer film, premium dental visuals, high-impact composition, dental brand atmosphere',
    negativePrompt: 'clinical sterility, harsh light, cluttered frame, poor smile reveal',
    outputPackage: ['master prompt', 'scene prompts', 'dental reveal CTA']
  },

  'dental-social-reel': {
    coreUseCase: 'Dental promo film',
    uiDescription: 'vertical social reel for hooks, offers, and visual moments. Built for dental brands seeking premium video.',
    promptGoal: 'Create a promo style dental video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Quick details', 'Moment', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'dental promo film, premium dental visuals, conversion-aware composition, dental brand atmosphere',
    negativePrompt: 'clinical sterility, harsh light, cluttered frame, poor smile reveal',
    outputPackage: ['master prompt', 'scene prompts', 'dental reveal CTA']
  },

  'dental-atmosphere-piece': {
    coreUseCase: 'Dental documentary style film',
    uiDescription: 'atmosphere-led film centered on environment and client experience. Built for dental brands seeking premium video.',
    promptGoal: 'Create a documentary style style dental video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Mood', 'Process detail', 'Calm moment', 'Interior close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'dental documentary style film, premium dental visuals, documentary realism composition, dental brand atmosphere',
    negativePrompt: 'clinical sterility, harsh light, cluttered frame, poor smile reveal',
    outputPackage: ['master prompt', 'scene prompts', 'dental reveal CTA']
  },

  'dental-luxury-offer': {
    coreUseCase: 'Dental cinematic commercial film',
    uiDescription: 'commercial-style premium offer video for campaigns or landing pages. Built for dental brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style dental video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Opener', 'Package reveal', 'Experience detail', 'Aspirational result', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'dental cinematic commercial film, premium dental visuals, premium composition, dental brand atmosphere',
    negativePrompt: 'clinical sterility, harsh light, cluttered frame, poor smile reveal',
    outputPackage: ['master prompt', 'scene prompts', 'dental reveal CTA']
  },

  'chiropractic-brand-film': {
    coreUseCase: 'Chiropractic cinematic commercial film',
    uiDescription: 'flagship chiropractic brand film for premium positioning and trust. Built for chiropractic brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style chiropractic video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Space or brand intro', 'Hero details', 'Human value moment', 'Brand reveal / CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'chiropractic cinematic commercial film, premium chiropractic visuals, premium composition, chiropractic brand atmosphere',
    negativePrompt: 'sterile feel, harsh light, cluttered frame, awkward posture',
    outputPackage: ['master prompt', 'scene prompts', 'chiropractic reveal CTA']
  },

  'chiropractic-process-doc': {
    coreUseCase: 'Chiropractic documentary style film',
    uiDescription: 'behind-the-scenes documentary about the chiropractic process and craft. Built for chiropractic brands seeking premium video.',
    promptGoal: 'Create a documentary style style chiropractic video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Context', 'Real-world process', 'Human detail', 'Insight', 'Grounded close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'chiropractic documentary style film, premium chiropractic visuals, documentary realism composition, chiropractic brand atmosphere',
    negativePrompt: 'sterile feel, harsh light, cluttered frame, awkward posture',
    outputPackage: ['master prompt', 'scene prompts', 'chiropractic reveal CTA']
  },

  'chiropractic-transformation-story': {
    coreUseCase: 'Chiropractic cinematic short film',
    uiDescription: 'emotional transformation piece centered on results and confidence. Built for chiropractic brands seeking premium video.',
    promptGoal: 'Create a cinematic short style chiropractic video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Before feeling', 'Process path', 'Emotional shift', 'After reveal', 'Brand close'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'chiropractic cinematic short film, premium chiropractic visuals, filmic composition, chiropractic brand atmosphere',
    negativePrompt: 'sterile feel, harsh light, cluttered frame, awkward posture',
    outputPackage: ['master prompt', 'scene prompts', 'chiropractic reveal CTA']
  },

  'chiropractic-testimonial': {
    coreUseCase: 'Chiropractic testimonial film',
    uiDescription: 'client proof story about experience and visible results. Built for chiropractic brands seeking premium video.',
    promptGoal: 'Create a testimonial style chiropractic video that drives engagement and trust.',
    visualStyle: 'Grounded realism, real energy, supportive, emotionally proof',
    sceneBlueprint: ['Problem', 'Frustration', 'Solution', 'Transformation', 'Trust-building close'],
    cinematography: 'Real customer energy, supportive b-roll, emotional proof moments',
    enhancerKeywords: 'chiropractic testimonial film, premium chiropractic visuals, grounded realism composition, chiropractic brand atmosphere',
    negativePrompt: 'sterile feel, harsh light, cluttered frame, awkward posture',
    outputPackage: ['master prompt', 'scene prompts', 'chiropractic reveal CTA']
  },

  'chiropractic-founder-doc': {
    coreUseCase: 'Chiropractic founder story film',
    uiDescription: 'founder or expert authority piece for trust and credibility. Built for chiropractic brands seeking premium video.',
    promptGoal: 'Create a founder story style chiropractic video that drives engagement and trust.',
    visualStyle: 'Portrait-led, emotional, authoritative, warm practical light',
    sceneBlueprint: ['Origin', 'Struggle', 'Mission', 'Breakthrough', 'Future / CTA'],
    cinematography: 'Portrait-led premium close-ups, emotional pacing, authority framing, warm practical light',
    enhancerKeywords: 'chiropractic founder story film, premium chiropractic visuals, portrait-led composition, chiropractic brand atmosphere',
    negativePrompt: 'sterile feel, harsh light, cluttered frame, awkward posture',
    outputPackage: ['master prompt', 'scene prompts', 'chiropractic reveal CTA']
  },

  'chiropractic-offer-promo': {
    coreUseCase: 'Chiropractic promo film',
    uiDescription: 'conversion-focused promo for a package, service, or booking offer. Built for chiropractic brands seeking premium video.',
    promptGoal: 'Create a promo style chiropractic video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Atmosphere', 'Offer intro', 'Benefit visuals', 'Urgency or exclusivity', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'chiropractic promo film, premium chiropractic visuals, conversion-aware composition, chiropractic brand atmosphere',
    negativePrompt: 'sterile feel, harsh light, cluttered frame, awkward posture',
    outputPackage: ['master prompt', 'scene prompts', 'chiropractic reveal CTA']
  },

  'chiropractic-launch-trailer': {
    coreUseCase: 'Chiropractic dramatic trailer film',
    uiDescription: 'high-drama launch teaser for a grand opening or new concept. Built for chiropractic brands seeking premium video.',
    promptGoal: 'Create a dramatic trailer style chiropractic video that drives engagement and trust.',
    visualStyle: 'High-impact, moody contrast, dramatic motion, big reveals',
    sceneBlueprint: ['Tension hook', 'Escalation', 'Partial reveal', 'Climax', 'Title card / CTA'],
    cinematography: 'High-impact pacing, moody contrast, reveal shots, dramatic camera motion',
    enhancerKeywords: 'chiropractic dramatic trailer film, premium chiropractic visuals, high-impact composition, chiropractic brand atmosphere',
    negativePrompt: 'sterile feel, harsh light, cluttered frame, awkward posture',
    outputPackage: ['master prompt', 'scene prompts', 'chiropractic reveal CTA']
  },

  'chiropractic-social-reel': {
    coreUseCase: 'Chiropractic promo film',
    uiDescription: 'vertical social reel for hooks, offers, and visual moments. Built for chiropractic brands seeking premium video.',
    promptGoal: 'Create a promo style chiropractic video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Quick details', 'Moment', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'chiropractic promo film, premium chiropractic visuals, conversion-aware composition, chiropractic brand atmosphere',
    negativePrompt: 'sterile feel, harsh light, cluttered frame, awkward posture',
    outputPackage: ['master prompt', 'scene prompts', 'chiropractic reveal CTA']
  },

  'chiropractic-atmosphere-piece': {
    coreUseCase: 'Chiropractic documentary style film',
    uiDescription: 'atmosphere-led film centered on environment and client experience. Built for chiropractic brands seeking premium video.',
    promptGoal: 'Create a documentary style style chiropractic video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Mood', 'Process detail', 'Calm moment', 'Interior close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'chiropractic documentary style film, premium chiropractic visuals, documentary realism composition, chiropractic brand atmosphere',
    negativePrompt: 'sterile feel, harsh light, cluttered frame, awkward posture',
    outputPackage: ['master prompt', 'scene prompts', 'chiropractic reveal CTA']
  },

  'chiropractic-luxury-offer': {
    coreUseCase: 'Chiropractic cinematic commercial film',
    uiDescription: 'commercial-style premium offer video for campaigns or landing pages. Built for chiropractic brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style chiropractic video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Opener', 'Package reveal', 'Experience detail', 'Aspirational result', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'chiropractic cinematic commercial film, premium chiropractic visuals, premium composition, chiropractic brand atmosphere',
    negativePrompt: 'sterile feel, harsh light, cluttered frame, awkward posture',
    outputPackage: ['master prompt', 'scene prompts', 'chiropractic reveal CTA']
  },

  'legal-brand-film': {
    coreUseCase: 'Legal cinematic commercial film',
    uiDescription: 'flagship legal brand film for premium positioning and trust. Built for legal brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style legal video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Space or brand intro', 'Hero details', 'Human value moment', 'Brand reveal / CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'legal cinematic commercial film, premium legal visuals, premium composition, legal brand atmosphere',
    negativePrompt: 'cheesy stock look, poor lighting, cluttered desk, weak authority',
    outputPackage: ['master prompt', 'scene prompts', 'legal reveal CTA']
  },

  'legal-process-doc': {
    coreUseCase: 'Legal documentary style film',
    uiDescription: 'behind-the-scenes documentary about the legal process and craft. Built for legal brands seeking premium video.',
    promptGoal: 'Create a documentary style style legal video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Context', 'Real-world process', 'Human detail', 'Insight', 'Grounded close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'legal documentary style film, premium legal visuals, documentary realism composition, legal brand atmosphere',
    negativePrompt: 'cheesy stock look, poor lighting, cluttered desk, weak authority',
    outputPackage: ['master prompt', 'scene prompts', 'legal reveal CTA']
  },

  'legal-transformation-story': {
    coreUseCase: 'Legal cinematic short film',
    uiDescription: 'emotional transformation piece centered on results and confidence. Built for legal brands seeking premium video.',
    promptGoal: 'Create a cinematic short style legal video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Before feeling', 'Process path', 'Emotional shift', 'After reveal', 'Brand close'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'legal cinematic short film, premium legal visuals, filmic composition, legal brand atmosphere',
    negativePrompt: 'cheesy stock look, poor lighting, cluttered desk, weak authority',
    outputPackage: ['master prompt', 'scene prompts', 'legal reveal CTA']
  },

  'legal-testimonial': {
    coreUseCase: 'Legal testimonial film',
    uiDescription: 'client proof story about experience and visible results. Built for legal brands seeking premium video.',
    promptGoal: 'Create a testimonial style legal video that drives engagement and trust.',
    visualStyle: 'Grounded realism, real energy, supportive, emotionally proof',
    sceneBlueprint: ['Problem', 'Frustration', 'Solution', 'Transformation', 'Trust-building close'],
    cinematography: 'Real customer energy, supportive b-roll, emotional proof moments',
    enhancerKeywords: 'legal testimonial film, premium legal visuals, grounded realism composition, legal brand atmosphere',
    negativePrompt: 'cheesy stock look, poor lighting, cluttered desk, weak authority',
    outputPackage: ['master prompt', 'scene prompts', 'legal reveal CTA']
  },

  'legal-founder-doc': {
    coreUseCase: 'Legal founder story film',
    uiDescription: 'founder or expert authority piece for trust and credibility. Built for legal brands seeking premium video.',
    promptGoal: 'Create a founder story style legal video that drives engagement and trust.',
    visualStyle: 'Portrait-led, emotional, authoritative, warm practical light',
    sceneBlueprint: ['Origin', 'Struggle', 'Mission', 'Breakthrough', 'Future / CTA'],
    cinematography: 'Portrait-led premium close-ups, emotional pacing, authority framing, warm practical light',
    enhancerKeywords: 'legal founder story film, premium legal visuals, portrait-led composition, legal brand atmosphere',
    negativePrompt: 'cheesy stock look, poor lighting, cluttered desk, weak authority',
    outputPackage: ['master prompt', 'scene prompts', 'legal reveal CTA']
  },

  'legal-offer-promo': {
    coreUseCase: 'Legal promo film',
    uiDescription: 'conversion-focused promo for a package, service, or booking offer. Built for legal brands seeking premium video.',
    promptGoal: 'Create a promo style legal video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Atmosphere', 'Offer intro', 'Benefit visuals', 'Urgency or exclusivity', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'legal promo film, premium legal visuals, conversion-aware composition, legal brand atmosphere',
    negativePrompt: 'cheesy stock look, poor lighting, cluttered desk, weak authority',
    outputPackage: ['master prompt', 'scene prompts', 'legal reveal CTA']
  },

  'legal-launch-trailer': {
    coreUseCase: 'Legal dramatic trailer film',
    uiDescription: 'high-drama launch teaser for a grand opening or new concept. Built for legal brands seeking premium video.',
    promptGoal: 'Create a dramatic trailer style legal video that drives engagement and trust.',
    visualStyle: 'High-impact, moody contrast, dramatic motion, big reveals',
    sceneBlueprint: ['Tension hook', 'Escalation', 'Partial reveal', 'Climax', 'Title card / CTA'],
    cinematography: 'High-impact pacing, moody contrast, reveal shots, dramatic camera motion',
    enhancerKeywords: 'legal dramatic trailer film, premium legal visuals, high-impact composition, legal brand atmosphere',
    negativePrompt: 'cheesy stock look, poor lighting, cluttered desk, weak authority',
    outputPackage: ['master prompt', 'scene prompts', 'legal reveal CTA']
  },

  'legal-social-reel': {
    coreUseCase: 'Legal promo film',
    uiDescription: 'vertical social reel for hooks, offers, and visual moments. Built for legal brands seeking premium video.',
    promptGoal: 'Create a promo style legal video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Quick details', 'Moment', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'legal promo film, premium legal visuals, conversion-aware composition, legal brand atmosphere',
    negativePrompt: 'cheesy stock look, poor lighting, cluttered desk, weak authority',
    outputPackage: ['master prompt', 'scene prompts', 'legal reveal CTA']
  },

  'legal-atmosphere-piece': {
    coreUseCase: 'Legal documentary style film',
    uiDescription: 'atmosphere-led film centered on environment and client experience. Built for legal brands seeking premium video.',
    promptGoal: 'Create a documentary style style legal video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Mood', 'Process detail', 'Calm moment', 'Interior close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'legal documentary style film, premium legal visuals, documentary realism composition, legal brand atmosphere',
    negativePrompt: 'cheesy stock look, poor lighting, cluttered desk, weak authority',
    outputPackage: ['master prompt', 'scene prompts', 'legal reveal CTA']
  },

  'legal-luxury-offer': {
    coreUseCase: 'Legal cinematic commercial film',
    uiDescription: 'commercial-style premium offer video for campaigns or landing pages. Built for legal brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style legal video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Opener', 'Package reveal', 'Experience detail', 'Aspirational result', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'legal cinematic commercial film, premium legal visuals, premium composition, legal brand atmosphere',
    negativePrompt: 'cheesy stock look, poor lighting, cluttered desk, weak authority',
    outputPackage: ['master prompt', 'scene prompts', 'legal reveal CTA']
  },

  'automotive-brand-film': {
    coreUseCase: 'Automotive cinematic commercial film',
    uiDescription: 'flagship automotive brand film for premium positioning and trust. Built for automotive brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style automotive video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Space or brand intro', 'Hero details', 'Human value moment', 'Brand reveal / CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'automotive cinematic commercial film, premium automotive visuals, premium composition, automotive brand atmosphere',
    negativePrompt: 'dirty car, poor reflection, flat light, cluttered frame',
    outputPackage: ['master prompt', 'scene prompts', 'automotive reveal CTA']
  },

  'automotive-process-doc': {
    coreUseCase: 'Automotive documentary style film',
    uiDescription: 'behind-the-scenes documentary about the automotive process and craft. Built for automotive brands seeking premium video.',
    promptGoal: 'Create a documentary style style automotive video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Context', 'Real-world process', 'Human detail', 'Insight', 'Grounded close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'automotive documentary style film, premium automotive visuals, documentary realism composition, automotive brand atmosphere',
    negativePrompt: 'dirty car, poor reflection, flat light, cluttered frame',
    outputPackage: ['master prompt', 'scene prompts', 'automotive reveal CTA']
  },

  'automotive-transformation-story': {
    coreUseCase: 'Automotive cinematic short film',
    uiDescription: 'emotional transformation piece centered on results and confidence. Built for automotive brands seeking premium video.',
    promptGoal: 'Create a cinematic short style automotive video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Before feeling', 'Process path', 'Emotional shift', 'After reveal', 'Brand close'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'automotive cinematic short film, premium automotive visuals, filmic composition, automotive brand atmosphere',
    negativePrompt: 'dirty car, poor reflection, flat light, cluttered frame',
    outputPackage: ['master prompt', 'scene prompts', 'automotive reveal CTA']
  },

  'automotive-testimonial': {
    coreUseCase: 'Automotive testimonial film',
    uiDescription: 'client proof story about experience and visible results. Built for automotive brands seeking premium video.',
    promptGoal: 'Create a testimonial style automotive video that drives engagement and trust.',
    visualStyle: 'Grounded realism, real energy, supportive, emotionally proof',
    sceneBlueprint: ['Problem', 'Frustration', 'Solution', 'Transformation', 'Trust-building close'],
    cinematography: 'Real customer energy, supportive b-roll, emotional proof moments',
    enhancerKeywords: 'automotive testimonial film, premium automotive visuals, grounded realism composition, automotive brand atmosphere',
    negativePrompt: 'dirty car, poor reflection, flat light, cluttered frame',
    outputPackage: ['master prompt', 'scene prompts', 'automotive reveal CTA']
  },

  'automotive-founder-doc': {
    coreUseCase: 'Automotive founder story film',
    uiDescription: 'founder or expert authority piece for trust and credibility. Built for automotive brands seeking premium video.',
    promptGoal: 'Create a founder story style automotive video that drives engagement and trust.',
    visualStyle: 'Portrait-led, emotional, authoritative, warm practical light',
    sceneBlueprint: ['Origin', 'Struggle', 'Mission', 'Breakthrough', 'Future / CTA'],
    cinematography: 'Portrait-led premium close-ups, emotional pacing, authority framing, warm practical light',
    enhancerKeywords: 'automotive founder story film, premium automotive visuals, portrait-led composition, automotive brand atmosphere',
    negativePrompt: 'dirty car, poor reflection, flat light, cluttered frame',
    outputPackage: ['master prompt', 'scene prompts', 'automotive reveal CTA']
  },

  'automotive-offer-promo': {
    coreUseCase: 'Automotive promo film',
    uiDescription: 'conversion-focused promo for a package, service, or booking offer. Built for automotive brands seeking premium video.',
    promptGoal: 'Create a promo style automotive video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Atmosphere', 'Offer intro', 'Benefit visuals', 'Urgency or exclusivity', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'automotive promo film, premium automotive visuals, conversion-aware composition, automotive brand atmosphere',
    negativePrompt: 'dirty car, poor reflection, flat light, cluttered frame',
    outputPackage: ['master prompt', 'scene prompts', 'automotive reveal CTA']
  },

  'automotive-launch-trailer': {
    coreUseCase: 'Automotive dramatic trailer film',
    uiDescription: 'high-drama launch teaser for a grand opening or new concept. Built for automotive brands seeking premium video.',
    promptGoal: 'Create a dramatic trailer style automotive video that drives engagement and trust.',
    visualStyle: 'High-impact, moody contrast, dramatic motion, big reveals',
    sceneBlueprint: ['Tension hook', 'Escalation', 'Partial reveal', 'Climax', 'Title card / CTA'],
    cinematography: 'High-impact pacing, moody contrast, reveal shots, dramatic camera motion',
    enhancerKeywords: 'automotive dramatic trailer film, premium automotive visuals, high-impact composition, automotive brand atmosphere',
    negativePrompt: 'dirty car, poor reflection, flat light, cluttered frame',
    outputPackage: ['master prompt', 'scene prompts', 'automotive reveal CTA']
  },

  'automotive-social-reel': {
    coreUseCase: 'Automotive promo film',
    uiDescription: 'vertical social reel for hooks, offers, and visual moments. Built for automotive brands seeking premium video.',
    promptGoal: 'Create a promo style automotive video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Quick details', 'Moment', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'automotive promo film, premium automotive visuals, conversion-aware composition, automotive brand atmosphere',
    negativePrompt: 'dirty car, poor reflection, flat light, cluttered frame',
    outputPackage: ['master prompt', 'scene prompts', 'automotive reveal CTA']
  },

  'automotive-atmosphere-piece': {
    coreUseCase: 'Automotive documentary style film',
    uiDescription: 'atmosphere-led film centered on environment and client experience. Built for automotive brands seeking premium video.',
    promptGoal: 'Create a documentary style style automotive video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Mood', 'Process detail', 'Calm moment', 'Interior close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'automotive documentary style film, premium automotive visuals, documentary realism composition, automotive brand atmosphere',
    negativePrompt: 'dirty car, poor reflection, flat light, cluttered frame',
    outputPackage: ['master prompt', 'scene prompts', 'automotive reveal CTA']
  },

  'automotive-luxury-offer': {
    coreUseCase: 'Automotive cinematic commercial film',
    uiDescription: 'commercial-style premium offer video for campaigns or landing pages. Built for automotive brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style automotive video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Opener', 'Package reveal', 'Experience detail', 'Aspirational result', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'automotive cinematic commercial film, premium automotive visuals, premium composition, automotive brand atmosphere',
    negativePrompt: 'dirty car, poor reflection, flat light, cluttered frame',
    outputPackage: ['master prompt', 'scene prompts', 'automotive reveal CTA']
  },

  'fashion-brand-film': {
    coreUseCase: 'Fashion cinematic commercial film',
    uiDescription: 'flagship fashion brand film for premium positioning and trust. Built for fashion brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style fashion video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Space or brand intro', 'Hero details', 'Human value moment', 'Brand reveal / CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'fashion cinematic commercial film, premium fashion visuals, premium composition, fashion brand atmosphere',
    negativePrompt: 'wrinkled fabric, poor lighting, cluttered frame, weak styling',
    outputPackage: ['master prompt', 'scene prompts', 'fashion reveal CTA']
  },

  'fashion-process-doc': {
    coreUseCase: 'Fashion documentary style film',
    uiDescription: 'behind-the-scenes documentary about the fashion process and craft. Built for fashion brands seeking premium video.',
    promptGoal: 'Create a documentary style style fashion video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Context', 'Real-world process', 'Human detail', 'Insight', 'Grounded close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'fashion documentary style film, premium fashion visuals, documentary realism composition, fashion brand atmosphere',
    negativePrompt: 'wrinkled fabric, poor lighting, cluttered frame, weak styling',
    outputPackage: ['master prompt', 'scene prompts', 'fashion reveal CTA']
  },

  'fashion-transformation-story': {
    coreUseCase: 'Fashion cinematic short film',
    uiDescription: 'emotional transformation piece centered on results and confidence. Built for fashion brands seeking premium video.',
    promptGoal: 'Create a cinematic short style fashion video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Before feeling', 'Process path', 'Emotional shift', 'After reveal', 'Brand close'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'fashion cinematic short film, premium fashion visuals, filmic composition, fashion brand atmosphere',
    negativePrompt: 'wrinkled fabric, poor lighting, cluttered frame, weak styling',
    outputPackage: ['master prompt', 'scene prompts', 'fashion reveal CTA']
  },

  'fashion-testimonial': {
    coreUseCase: 'Fashion testimonial film',
    uiDescription: 'client proof story about experience and visible results. Built for fashion brands seeking premium video.',
    promptGoal: 'Create a testimonial style fashion video that drives engagement and trust.',
    visualStyle: 'Grounded realism, real energy, supportive, emotionally proof',
    sceneBlueprint: ['Problem', 'Frustration', 'Solution', 'Transformation', 'Trust-building close'],
    cinematography: 'Real customer energy, supportive b-roll, emotional proof moments',
    enhancerKeywords: 'fashion testimonial film, premium fashion visuals, grounded realism composition, fashion brand atmosphere',
    negativePrompt: 'wrinkled fabric, poor lighting, cluttered frame, weak styling',
    outputPackage: ['master prompt', 'scene prompts', 'fashion reveal CTA']
  },

  'fashion-founder-doc': {
    coreUseCase: 'Fashion founder story film',
    uiDescription: 'founder or expert authority piece for trust and credibility. Built for fashion brands seeking premium video.',
    promptGoal: 'Create a founder story style fashion video that drives engagement and trust.',
    visualStyle: 'Portrait-led, emotional, authoritative, warm practical light',
    sceneBlueprint: ['Origin', 'Struggle', 'Mission', 'Breakthrough', 'Future / CTA'],
    cinematography: 'Portrait-led premium close-ups, emotional pacing, authority framing, warm practical light',
    enhancerKeywords: 'fashion founder story film, premium fashion visuals, portrait-led composition, fashion brand atmosphere',
    negativePrompt: 'wrinkled fabric, poor lighting, cluttered frame, weak styling',
    outputPackage: ['master prompt', 'scene prompts', 'fashion reveal CTA']
  },

  'fashion-offer-promo': {
    coreUseCase: 'Fashion promo film',
    uiDescription: 'conversion-focused promo for a package, service, or booking offer. Built for fashion brands seeking premium video.',
    promptGoal: 'Create a promo style fashion video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Atmosphere', 'Offer intro', 'Benefit visuals', 'Urgency or exclusivity', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'fashion promo film, premium fashion visuals, conversion-aware composition, fashion brand atmosphere',
    negativePrompt: 'wrinkled fabric, poor lighting, cluttered frame, weak styling',
    outputPackage: ['master prompt', 'scene prompts', 'fashion reveal CTA']
  },

  'fashion-launch-trailer': {
    coreUseCase: 'Fashion dramatic trailer film',
    uiDescription: 'high-drama launch teaser for a grand opening or new concept. Built for fashion brands seeking premium video.',
    promptGoal: 'Create a dramatic trailer style fashion video that drives engagement and trust.',
    visualStyle: 'High-impact, moody contrast, dramatic motion, big reveals',
    sceneBlueprint: ['Tension hook', 'Escalation', 'Partial reveal', 'Climax', 'Title card / CTA'],
    cinematography: 'High-impact pacing, moody contrast, reveal shots, dramatic camera motion',
    enhancerKeywords: 'fashion dramatic trailer film, premium fashion visuals, high-impact composition, fashion brand atmosphere',
    negativePrompt: 'wrinkled fabric, poor lighting, cluttered frame, weak styling',
    outputPackage: ['master prompt', 'scene prompts', 'fashion reveal CTA']
  },

  'fashion-social-reel': {
    coreUseCase: 'Fashion promo film',
    uiDescription: 'vertical social reel for hooks, offers, and visual moments. Built for fashion brands seeking premium video.',
    promptGoal: 'Create a promo style fashion video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Quick details', 'Moment', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'fashion promo film, premium fashion visuals, conversion-aware composition, fashion brand atmosphere',
    negativePrompt: 'wrinkled fabric, poor lighting, cluttered frame, weak styling',
    outputPackage: ['master prompt', 'scene prompts', 'fashion reveal CTA']
  },

  'fashion-atmosphere-piece': {
    coreUseCase: 'Fashion documentary style film',
    uiDescription: 'atmosphere-led film centered on environment and client experience. Built for fashion brands seeking premium video.',
    promptGoal: 'Create a documentary style style fashion video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Mood', 'Process detail', 'Calm moment', 'Interior close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'fashion documentary style film, premium fashion visuals, documentary realism composition, fashion brand atmosphere',
    negativePrompt: 'wrinkled fabric, poor lighting, cluttered frame, weak styling',
    outputPackage: ['master prompt', 'scene prompts', 'fashion reveal CTA']
  },

  'fashion-luxury-offer': {
    coreUseCase: 'Fashion cinematic commercial film',
    uiDescription: 'commercial-style premium offer video for campaigns or landing pages. Built for fashion brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style fashion video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Opener', 'Package reveal', 'Experience detail', 'Aspirational result', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'fashion cinematic commercial film, premium fashion visuals, premium composition, fashion brand atmosphere',
    negativePrompt: 'wrinkled fabric, poor lighting, cluttered frame, weak styling',
    outputPackage: ['master prompt', 'scene prompts', 'fashion reveal CTA']
  },

  'event-brand-film': {
    coreUseCase: 'Event cinematic commercial film',
    uiDescription: 'flagship event brand film for premium positioning and trust. Built for event brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style event video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Space or brand intro', 'Hero details', 'Human value moment', 'Brand reveal / CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'event cinematic commercial film, premium event visuals, premium composition, event brand atmosphere',
    negativePrompt: 'empty room, poor lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'event reveal CTA']
  },

  'event-process-doc': {
    coreUseCase: 'Event documentary style film',
    uiDescription: 'behind-the-scenes documentary about the event process and craft. Built for event brands seeking premium video.',
    promptGoal: 'Create a documentary style style event video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Context', 'Real-world process', 'Human detail', 'Insight', 'Grounded close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'event documentary style film, premium event visuals, documentary realism composition, event brand atmosphere',
    negativePrompt: 'empty room, poor lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'event reveal CTA']
  },

  'event-transformation-story': {
    coreUseCase: 'Event cinematic short film',
    uiDescription: 'emotional transformation piece centered on results and confidence. Built for event brands seeking premium video.',
    promptGoal: 'Create a cinematic short style event video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Before feeling', 'Process path', 'Emotional shift', 'After reveal', 'Brand close'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'event cinematic short film, premium event visuals, filmic composition, event brand atmosphere',
    negativePrompt: 'empty room, poor lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'event reveal CTA']
  },

  'event-testimonial': {
    coreUseCase: 'Event testimonial film',
    uiDescription: 'client proof story about experience and visible results. Built for event brands seeking premium video.',
    promptGoal: 'Create a testimonial style event video that drives engagement and trust.',
    visualStyle: 'Grounded realism, real energy, supportive, emotionally proof',
    sceneBlueprint: ['Problem', 'Frustration', 'Solution', 'Transformation', 'Trust-building close'],
    cinematography: 'Real customer energy, supportive b-roll, emotional proof moments',
    enhancerKeywords: 'event testimonial film, premium event visuals, grounded realism composition, event brand atmosphere',
    negativePrompt: 'empty room, poor lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'event reveal CTA']
  },

  'event-founder-doc': {
    coreUseCase: 'Event founder story film',
    uiDescription: 'founder or expert authority piece for trust and credibility. Built for event brands seeking premium video.',
    promptGoal: 'Create a founder story style event video that drives engagement and trust.',
    visualStyle: 'Portrait-led, emotional, authoritative, warm practical light',
    sceneBlueprint: ['Origin', 'Struggle', 'Mission', 'Breakthrough', 'Future / CTA'],
    cinematography: 'Portrait-led premium close-ups, emotional pacing, authority framing, warm practical light',
    enhancerKeywords: 'event founder story film, premium event visuals, portrait-led composition, event brand atmosphere',
    negativePrompt: 'empty room, poor lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'event reveal CTA']
  },

  'event-offer-promo': {
    coreUseCase: 'Event promo film',
    uiDescription: 'conversion-focused promo for a package, service, or booking offer. Built for event brands seeking premium video.',
    promptGoal: 'Create a promo style event video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Atmosphere', 'Offer intro', 'Benefit visuals', 'Urgency or exclusivity', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'event promo film, premium event visuals, conversion-aware composition, event brand atmosphere',
    negativePrompt: 'empty room, poor lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'event reveal CTA']
  },

  'event-launch-trailer': {
    coreUseCase: 'Event dramatic trailer film',
    uiDescription: 'high-drama launch teaser for a grand opening or new concept. Built for event brands seeking premium video.',
    promptGoal: 'Create a dramatic trailer style event video that drives engagement and trust.',
    visualStyle: 'High-impact, moody contrast, dramatic motion, big reveals',
    sceneBlueprint: ['Tension hook', 'Escalation', 'Partial reveal', 'Climax', 'Title card / CTA'],
    cinematography: 'High-impact pacing, moody contrast, reveal shots, dramatic camera motion',
    enhancerKeywords: 'event dramatic trailer film, premium event visuals, high-impact composition, event brand atmosphere',
    negativePrompt: 'empty room, poor lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'event reveal CTA']
  },

  'event-social-reel': {
    coreUseCase: 'Event promo film',
    uiDescription: 'vertical social reel for hooks, offers, and visual moments. Built for event brands seeking premium video.',
    promptGoal: 'Create a promo style event video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Quick details', 'Moment', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'event promo film, premium event visuals, conversion-aware composition, event brand atmosphere',
    negativePrompt: 'empty room, poor lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'event reveal CTA']
  },

  'event-atmosphere-piece': {
    coreUseCase: 'Event documentary style film',
    uiDescription: 'atmosphere-led film centered on environment and client experience. Built for event brands seeking premium video.',
    promptGoal: 'Create a documentary style style event video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Mood', 'Process detail', 'Calm moment', 'Interior close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'event documentary style film, premium event visuals, documentary realism composition, event brand atmosphere',
    negativePrompt: 'empty room, poor lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'event reveal CTA']
  },

  'event-luxury-offer': {
    coreUseCase: 'Event cinematic commercial film',
    uiDescription: 'commercial-style premium offer video for campaigns or landing pages. Built for event brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style event video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Opener', 'Package reveal', 'Experience detail', 'Aspirational result', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'event cinematic commercial film, premium event visuals, premium composition, event brand atmosphere',
    negativePrompt: 'empty room, poor lighting, cluttered frame, weak energy',
    outputPackage: ['master prompt', 'scene prompts', 'event reveal CTA']
  },

  'luxury-brand-brand-film': {
    coreUseCase: 'Luxury-brand cinematic commercial film',
    uiDescription: 'flagship luxury-brand brand film for premium positioning and trust. Built for luxury-brand brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style luxury-brand video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Hook', 'Space or brand intro', 'Hero details', 'Human value moment', 'Brand reveal / CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'luxury-brand cinematic commercial film, premium luxury-brand visuals, premium composition, luxury-brand brand atmosphere',
    negativePrompt: 'cheap look, cluttered frame, poor lighting, weak composition',
    outputPackage: ['master prompt', 'scene prompts', 'luxury-brand reveal CTA']
  },

  'luxury-brand-process-doc': {
    coreUseCase: 'Luxury-brand documentary style film',
    uiDescription: 'behind-the-scenes documentary about the luxury-brand process and craft. Built for luxury-brand brands seeking premium video.',
    promptGoal: 'Create a documentary style style luxury-brand video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Context', 'Real-world process', 'Human detail', 'Insight', 'Grounded close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'luxury-brand documentary style film, premium luxury-brand visuals, documentary realism composition, luxury-brand brand atmosphere',
    negativePrompt: 'cheap look, cluttered frame, poor lighting, weak composition',
    outputPackage: ['master prompt', 'scene prompts', 'luxury-brand reveal CTA']
  },

  'luxury-brand-transformation-story': {
    coreUseCase: 'Luxury-brand cinematic short film',
    uiDescription: 'emotional transformation piece centered on results and confidence. Built for luxury-brand brands seeking premium video.',
    promptGoal: 'Create a cinematic short style luxury-brand video that drives engagement and trust.',
    visualStyle: 'Filmic, emotional, premium textures, cinematic reveal',
    sceneBlueprint: ['Before feeling', 'Process path', 'Emotional shift', 'After reveal', 'Brand close'],
    cinematography: 'Filmic narrative, emotional progression, premium textures, cinematic reveal moments',
    enhancerKeywords: 'luxury-brand cinematic short film, premium luxury-brand visuals, filmic composition, luxury-brand brand atmosphere',
    negativePrompt: 'cheap look, cluttered frame, poor lighting, weak composition',
    outputPackage: ['master prompt', 'scene prompts', 'luxury-brand reveal CTA']
  },

  'luxury-brand-testimonial': {
    coreUseCase: 'Luxury-brand testimonial film',
    uiDescription: 'client proof story about experience and visible results. Built for luxury-brand brands seeking premium video.',
    promptGoal: 'Create a testimonial style luxury-brand video that drives engagement and trust.',
    visualStyle: 'Grounded realism, real energy, supportive, emotionally proof',
    sceneBlueprint: ['Problem', 'Frustration', 'Solution', 'Transformation', 'Trust-building close'],
    cinematography: 'Real customer energy, supportive b-roll, emotional proof moments',
    enhancerKeywords: 'luxury-brand testimonial film, premium luxury-brand visuals, grounded realism composition, luxury-brand brand atmosphere',
    negativePrompt: 'cheap look, cluttered frame, poor lighting, weak composition',
    outputPackage: ['master prompt', 'scene prompts', 'luxury-brand reveal CTA']
  },

  'luxury-brand-founder-doc': {
    coreUseCase: 'Luxury-brand founder story film',
    uiDescription: 'founder or expert authority piece for trust and credibility. Built for luxury-brand brands seeking premium video.',
    promptGoal: 'Create a founder story style luxury-brand video that drives engagement and trust.',
    visualStyle: 'Portrait-led, emotional, authoritative, warm practical light',
    sceneBlueprint: ['Origin', 'Struggle', 'Mission', 'Breakthrough', 'Future / CTA'],
    cinematography: 'Portrait-led premium close-ups, emotional pacing, authority framing, warm practical light',
    enhancerKeywords: 'luxury-brand founder story film, premium luxury-brand visuals, portrait-led composition, luxury-brand brand atmosphere',
    negativePrompt: 'cheap look, cluttered frame, poor lighting, weak composition',
    outputPackage: ['master prompt', 'scene prompts', 'luxury-brand reveal CTA']
  },

  'luxury-brand-offer-promo': {
    coreUseCase: 'Luxury-brand promo film',
    uiDescription: 'conversion-focused promo for a package, service, or booking offer. Built for luxury-brand brands seeking premium video.',
    promptGoal: 'Create a promo style luxury-brand video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Atmosphere', 'Offer intro', 'Benefit visuals', 'Urgency or exclusivity', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'luxury-brand promo film, premium luxury-brand visuals, conversion-aware composition, luxury-brand brand atmosphere',
    negativePrompt: 'cheap look, cluttered frame, poor lighting, weak composition',
    outputPackage: ['master prompt', 'scene prompts', 'luxury-brand reveal CTA']
  },

  'luxury-brand-launch-trailer': {
    coreUseCase: 'Luxury-brand dramatic trailer film',
    uiDescription: 'high-drama launch teaser for a grand opening or new concept. Built for luxury-brand brands seeking premium video.',
    promptGoal: 'Create a dramatic trailer style luxury-brand video that drives engagement and trust.',
    visualStyle: 'High-impact, moody contrast, dramatic motion, big reveals',
    sceneBlueprint: ['Tension hook', 'Escalation', 'Partial reveal', 'Climax', 'Title card / CTA'],
    cinematography: 'High-impact pacing, moody contrast, reveal shots, dramatic camera motion',
    enhancerKeywords: 'luxury-brand dramatic trailer film, premium luxury-brand visuals, high-impact composition, luxury-brand brand atmosphere',
    negativePrompt: 'cheap look, cluttered frame, poor lighting, weak composition',
    outputPackage: ['master prompt', 'scene prompts', 'luxury-brand reveal CTA']
  },

  'luxury-brand-social-reel': {
    coreUseCase: 'Luxury-brand promo film',
    uiDescription: 'vertical social reel for hooks, offers, and visual moments. Built for luxury-brand brands seeking premium video.',
    promptGoal: 'Create a promo style luxury-brand video that drives engagement and trust.',
    visualStyle: 'Conversion-aware, persuasive, elegant momentum, clean finish',
    sceneBlueprint: ['Hook', 'Quick details', 'Moment', 'CTA'],
    cinematography: 'Clean CTA ending, persuasive framing, elegant momentum',
    enhancerKeywords: 'luxury-brand promo film, premium luxury-brand visuals, conversion-aware composition, luxury-brand brand atmosphere',
    negativePrompt: 'cheap look, cluttered frame, poor lighting, weak composition',
    outputPackage: ['master prompt', 'scene prompts', 'luxury-brand reveal CTA']
  },

  'luxury-brand-atmosphere-piece': {
    coreUseCase: 'Luxury-brand documentary style film',
    uiDescription: 'atmosphere-led film centered on environment and client experience. Built for luxury-brand brands seeking premium video.',
    promptGoal: 'Create a documentary style style luxury-brand video that drives engagement and trust.',
    visualStyle: 'Documentary realism, natural light, observational, grounded',
    sceneBlueprint: ['Mood', 'Process detail', 'Calm moment', 'Interior close'],
    cinematography: 'Natural light feel, observational framing, subtle handheld or measured movement',
    enhancerKeywords: 'luxury-brand documentary style film, premium luxury-brand visuals, documentary realism composition, luxury-brand brand atmosphere',
    negativePrompt: 'cheap look, cluttered frame, poor lighting, weak composition',
    outputPackage: ['master prompt', 'scene prompts', 'luxury-brand reveal CTA']
  },

  'luxury-brand-luxury-offer': {
    coreUseCase: 'Luxury-brand cinematic commercial film',
    uiDescription: 'commercial-style premium offer video for campaigns or landing pages. Built for luxury-brand brands seeking premium video.',
    promptGoal: 'Create a cinematic commercial style luxury-brand video that drives engagement and trust.',
    visualStyle: 'Premium, polished, brand-forward, controlled lighting',
    sceneBlueprint: ['Opener', 'Package reveal', 'Experience detail', 'Aspirational result', 'CTA'],
    cinematography: 'Slow dolly or tracking movement, controlled lighting, clear subject focus',
    enhancerKeywords: 'luxury-brand cinematic commercial film, premium luxury-brand visuals, premium composition, luxury-brand brand atmosphere',
    negativePrompt: 'cheap look, cluttered frame, poor lighting, weak composition',
    outputPackage: ['master prompt', 'scene prompts', 'luxury-brand reveal CTA']
  },

};

// Helper function to get template specs
export function getTemplateSpecs(templateId) {
  return TEMPLATE_SPECS[templateId] || null;
}

// Helper function to check if template has enhanced specs
export function hasEnhancedSpecs(templateId) {
  return templateId in TEMPLATE_SPECS;
}

// Get all template IDs with enhanced specs
export function getEnhancedTemplateIds() {
  return Object.keys(TEMPLATE_SPECS);
}

export default TEMPLATE_SPECS;
