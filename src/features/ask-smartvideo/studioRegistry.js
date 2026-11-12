// Ask SmartVideo — studio knowledge registry.
//
// The single source of truth for what the assistant knows about each studio.
// Entries mirror the side menu in src/lib/studioRoutes.js (NAV_GROUPS); a test
// (src/features/ask-smartvideo/__tests__/askSmartVideo.test.js) fails if a menu
// studio has no entry here, or an entry points at a route that doesn't exist.
//
// Content is written from the studio code and docs (EditStudio EDIT_TOOLS,
// UpscaleStudio UPSCALE_METHODS, CinemaStudio CAMERA_MOVEMENTS, …). Keep it
// factual — the assistant answers ONLY from this text. Do not add retired
// routes (training, chat, assist, community) or marketing-only apps.
//
// Shape: { id, label, category, tagline, features[], steps[], tips[], limits[], intents[] }
//   intents = plain-language things people say ("remove the background").
// The route is always `#/<id>` (see STUDIO_ROUTES / router.js).

export const STUDIOS = [
  // ── Home ────────────────────────────────────────────────────────────────
  {
    id: 'apps', label: 'Apps', category: 'Home',
    tagline: 'The hub that lists every studio and tool in one place.',
    features: ['Cards for each studio with a one-line description', 'Jump into any studio with one click'],
    intents: ['where do I start', 'show me all the tools', 'what can this app do', 'list of studios'],
  },
  {
    id: 'explore', label: 'Explore', category: 'Home',
    tagline: 'Browse example creations for inspiration.',
    features: ['Gallery of example generations to get ideas from'],
    intents: ['show me examples', 'inspiration', 'what can people make'],
  },
  {
    id: 'templates', label: 'Templates', category: 'Home',
    tagline: 'Start from ready-made templates instead of a blank prompt.',
    features: ['Pick a template, add your own media or text, then generate'],
    intents: ['use a template', 'ready made', 'quick start without writing a prompt'],
  },

  // ── Image ───────────────────────────────────────────────────────────────
  {
    id: 'image', label: 'Image Studio', category: 'Image',
    tagline: 'Generate images from text (text-to-image) or from a reference image (image-to-image).',
    features: [
      '20+ image models (for example Flux, Nano Banana, Midjourney v7) chosen from the model picker',
      'Aspect ratio and resolution controls, negative prompt and advanced parameters',
      'Batch generation, LoRA support, prompt gallery and recipes',
      'Text to Image and Image to Image modes (also reachable as #/text-to-image and #/image-to-image)',
    ],
    steps: [
      'Choose a model in the sidebar. Models differ in strengths for portraits, landscapes or abstract art.',
      'Write your prompt: describe subject, style, lighting, composition and mood.',
      'Set aspect ratio, resolution and other settings. Use a negative prompt to exclude things.',
      'Click Generate, then iterate on the prompt. Results are saved to your Library.',
    ],
    tips: ['Add words like "4K, detailed, professional" to improve quality', 'Specify camera angles such as "shot from below"', 'Reference art styles such as "watercolor painting"'],
    intents: ['make an image', 'generate a picture', 'text to image', 'turn my photo into a different style', 'create art from a prompt', 'which image model is best'],
  },
  {
    id: 'edit', label: 'Edit Studio', category: 'Image',
    tagline: 'AI photo editing tools: remove objects or backgrounds, extend, reframe, restyle and more.',
    features: [
      'Remove Object (optionally upload a mask: white = remove, black = keep)',
      'Remove Background',
      'Extend Image (outpainting)',
      'AI Edit (Seedream 5.0 edit): describe the change; choose aspect ratio and quality (basic or high)',
      'Reframe (Ideogram v3): change aspect ratio with render speed Turbo/Balanced/Quality, style, and 1–4 variations',
      'Also: Change Dress (garment image), Enhance Skin, Colorize, Add Watermark (position, opacity, size), Upscale, Face Swap',
    ],
    steps: [
      'Pick the tool you need from the tool list.',
      'Upload your image (and a second image/mask when the tool asks for one).',
      'Set the options for that tool, or write the edit prompt for AI Edit.',
      'Click Generate and download or reuse the result.',
    ],
    tips: ['Use AI Edit when you can describe the change in words', 'Use Remove Object with a painted or uploaded mask for precise removal'],
    intents: ['remove the background', 'erase an object from a photo', 'extend my image', 'change the aspect ratio of a picture', 'fix my photo', 'swap a face', 'colorize an old photo', 'add a watermark', 'change clothes'],
  },
  {
    id: 'upscale', label: 'Upscale Suite', category: 'Image',
    tagline: 'Increase image resolution and sharpen detail with AI.',
    features: ['AI Upscaler (2x or 4x)', 'Topaz image upscale', 'SeedVR2 image upscale'],
    steps: ['Upload the image.', 'Choose an upscale method and scale.', 'Generate and compare with the original.'],
    intents: ['make my image bigger', 'increase resolution', 'sharpen a blurry photo', 'enhance quality', '4x upscale'],
  },
  {
    id: 'character', label: 'Character Studio', category: 'Image',
    tagline: 'Create consistent characters that keep the same face across images.',
    features: ['Flux PuLID (face ID) and MiniMax Subject Reference models', 'Upload reference photos to lock identity', 'Consistency helpers so one character appears in many scenes'],
    intents: ['same character in different scenes', 'keep the same face', 'consistent character', 'put my face in an image', 'character reference'],
  },
  {
    id: 'commercial', label: 'Product Shot Studio', category: 'Image',
    tagline: 'Turn one product photo into studio-quality product and ad images.',
    features: [
      'Scene presets such as studio white, marble, outdoor and neon showroom',
      'Format presets: Ad Banner 16:9, Social 1:1, Story 9:16, Billboard 21:9',
      'Default model: ai-product-shot',
    ],
    intents: ['product photo', 'ecommerce images', 'ad banner from a product picture', 'put my product on a marble table', 'commercial shot'],
  },
  {
    id: 'brand', label: 'Brand Studio', category: 'Image',
    tagline: 'Brand-consistent content: capture your brand, build campaigns, edit assets, make photo shoots.',
    features: [
      'Brand DNA editor (#/brand-dna) to capture your brand look and voice',
      'Campaign wizard (#/campaign): goal → concepts → platform assets',
      'Asset editor (#/asset-edit): headline, body and CTA placed in 9 positions',
      'Photo Studio (#/photo-studio): 6 categories × 5 styles = 30 presets',
    ],
    intents: ['brand kit', 'marketing campaign', 'consistent brand look', 'social media assets for my brand', 'photo shoot presets'],
  },
  {
    id: 'influencer', label: 'AI Influencer', category: 'Image',
    tagline: 'Create a virtual influencer with a consistent look and styled content.',
    features: ['20 style presets (for example Realistic, Quiet luxury, Y2K Posters, Coquette core)', 'Format presets: Instagram 1:1, Story 9:16, YouTube 16:9, Pinterest 2:3', 'Face and character-type tabs'],
    limits: ['Reachable at #/influencer but not listed in the side menu'],
    intents: ['virtual influencer', 'ai model for instagram', 'fashion influencer images'],
  },

  // ── Video ───────────────────────────────────────────────────────────────
  {
    id: 'video', label: 'Video Studio', category: 'Video',
    tagline: 'Create AI videos from text (text-to-video) or from an image (image-to-video).',
    features: [
      '15+ video models, with durations, resolutions and aspect ratios depending on the model',
      'Image-to-video with first (and last) frame',
      'Also reachable as #/text-to-video, #/image-to-video, #/video-to-video and #/video-watermark (watermark remover)',
    ],
    steps: [
      'Choose text-to-video or image-to-video. Image-to-video uses your photo as the first frame.',
      'Upload a clear photo or write a detailed scene and motion description.',
      'Set resolution (480p–1080p), duration (about 3–10 s) and aspect ratio.',
      'Generate. Video takes roughly 1–3 minutes; the result appears in your Library.',
    ],
    tips: ['Start with image-to-video for more predictable results', 'Keep prompts focused on one action or movement', '720p is a good quality/speed balance'],
    intents: ['make a video from text', 'animate my photo', 'generate a clip', 'text to video', 'image to video', 'remove a watermark from a video', 'which video model'],
  },
  {
    id: 'cinema', label: 'Cinema Studio', category: 'Video',
    tagline: 'Cinematic shots with real camera controls.',
    features: [
      'Camera movements: Static, Dolly In/Out, Crane Up, Orbit, FPV Drone, Handheld, Pan, Tilt, Dolly Zoom',
      'Film looks: Natural, Anamorphic, Teal & Orange, Moody Noir, Vintage, Neon Nights, Documentary, Golden Hour',
      'Camera body, lens, focal length and aperture controls',
    ],
    intents: ['cinematic shot', 'camera movement', 'film look', 'drone shot', 'dolly zoom', 'movie style video'],
  },
  {
    id: 'cinema-template', label: 'Cinema Templates', category: 'Video',
    tagline: 'Ready-made cinematic templates: add your media and generate.',
    features: ['Pre-built cinematic scenes with scene logic', 'Add your own photo or subject and generate'],
    intents: ['cinematic template', 'movie scene template', 'preset cinematic video'],
  },
  {
    id: 'storyboard', label: 'Storyboard Studio', category: 'Video',
    tagline: 'Plan and generate multi-frame sequences and storyboards.',
    features: [
      'Shot presets: Wide, Medium, Close-Up, Extreme Close-Up, POV, Overhead, Low Angle',
      'Video type, tone, style, lighting and colour options',
      'Layouts: horizontal, grid, story; project persistence',
    ],
    intents: ['storyboard', 'plan shots', 'sequence of frames', 'shot list', 'multi-scene story'],
  },
  {
    id: 'effects', label: 'Effects Studio', category: 'Video',
    tagline: '350+ AI motion and visual effects for images and videos.',
    features: [
      'Tabs: Image Effects, Nano Banana, Kontext Effects, Video Effects, Motion Controls, Video FX v2',
      'Before/after compare and layers with blend modes',
    ],
    intents: ['add an effect', 'special effects', 'ghibli style', 'visual effects on my photo', 'motion effect'],
  },
  {
    id: 'ai-vfx', label: 'AI VFX Studio', category: 'Video',
    tagline: 'Camera moves, VFX and AI effects from a single image.',
    features: ['AI Effects, Motion Controls and VFX categories (for example explosions, lightning)', 'Runs through MuAPI generate_wan_ai_effects'],
    intents: ['explosion effect', 'vfx from one image', 'camera move on a still', 'lightning effect'],
  },
  {
    id: 'animate', label: 'Animate Studio', category: 'Video',
    tagline: 'Bring still images to life with image-to-video motion.',
    features: ['Image-to-video; the model is chosen from the live model catalog'],
    intents: ['animate a picture', 'make my image move', 'photo to motion'],
  },
  {
    id: 'lipsync', label: 'Lip Sync Studio', category: 'Video',
    tagline: 'Make a portrait talk, or re-sync the lips in a video to new audio.',
    features: ['Image + audio → talking video', 'Video + audio → lip-synced video'],
    intents: ['make my photo talk', 'sync lips to audio', 'dub a video', 'talking portrait'],
  },
  {
    id: 'videotools', label: 'Video Tools', category: 'Video',
    tagline: 'Video utilities: upscale, enhance, translate, recast and motion control.',
    features: ['Tabs: Tools, Recast and Motion control (URL ?mode=recast or ?mode=control)', 'Tools such as upscale, enhance and translate'],
    intents: ['upscale a video', 'enhance video quality', 'translate a video', 'replace a character in a video', 'video motion control'],
  },
  {
    id: 'avatar', label: 'Avatar Studio', category: 'Video',
    tagline: 'Talking-head AI avatars from an image or video plus audio.',
    features: ['Create avatar videos that speak your audio'],
    intents: ['ai avatar', 'talking head', 'spokesperson video', 'presenter video'],
  },
  {
    id: 'audio', label: 'Audio Studio', category: 'Video',
    tagline: 'Generate music, speech (text-to-speech) and sound effects.',
    features: ['Music styles, voices with speed/pitch control, and sound effects'],
    intents: ['make music', 'text to speech', 'voiceover', 'sound effects', 'generate a song', 'background music'],
  },

  // ── Agents ──────────────────────────────────────────────────────────────
  {
    id: 'video-agent', label: 'Video Agent', category: 'Agents',
    tagline: 'Prompt-to-motion-graphics video agent.',
    features: ['Describe a video; the agent builds a motion-graphics piece', 'Preview in a Remotion player and render an MP4 in the browser', 'Uses your own OpenAI key from Settings'],
    intents: ['make a video from a prompt', 'motion graphics', 'explainer video agent', 'automatic video'],
  },
  {
    id: 'motion-director', label: 'Motion Director', category: 'Agents',
    tagline: 'Chat that plans a film from a prompt and a website, using 150 shot recipes.',
    features: ['Plans shots from your brief and website', 'Opens in the Motion Workbench for editing (#/motion-director/workbench)'],
    limits: ['Reachable at #/motion-director but not listed in the side menu'],
    intents: ['plan a promo video from my website', 'shot recipes', 'product video from a url'],
  },
  {
    id: 'director', label: 'Director', category: 'Agents',
    tagline: 'AI editor that cuts and directs your footage using specialised agents.',
    features: ['45 agents that call real backend endpoints'],
    intents: ['edit my footage with ai', 'auto cut', 'ai editor'],
  },
  {
    id: 'timeline', label: 'Timeline Editor', category: 'Agents',
    tagline: 'Multi-track timeline for editing and rendering, with an AI chat panel.',
    features: [
      'Multi-track editing and export',
      'AI chat modes: Ask (questions about the project), Search (find quotes and moments), Cut (rough cut into a new tab), Timeline (pacing suggestions)',
      'AI chat uses your own OpenAI key',
    ],
    intents: ['edit a video', 'multi track timeline', 'rough cut', 'find a moment in my video', 'export a video'],
  },
  {
    id: 'workbench', label: 'Workbench', category: 'Agents',
    tagline: 'Node-and-track workspace to chain generations together.',
    features: ['Workflow canvas for chaining generation steps', 'AI chat that can propose edits'],
    intents: ['chain generations', 'workflow', 'node editor'],
  },
  {
    id: 'viral', label: 'Smart Video Viral', category: 'Agents',
    tagline: 'AI-powered viral video generation.',
    features: ['Generate short-form videos designed to perform on social platforms'],
    intents: ['viral video', 'tiktok video', 'shorts', 'social video'],
  },
  {
    id: 'personalizer', label: 'Personalizer', category: 'Agents',
    tagline: 'Personalize templates and assets with your own data.',
    features: ['Canvas editor with personalization tokens'],
    intents: ['personalized video', 'mail merge for images', 'custom assets per customer'],
  },
  {
    id: 'leadfinder', label: 'Lead Finder', category: 'Agents',
    tagline: 'Find local businesses and score them as leads.',
    features: ['OpenStreetMap business search and lead scoring'],
    limits: ['Reachable at #/leadfinder but not listed in the side menu'],
    intents: ['find leads', 'local businesses', 'prospects'],
  },
  {
    id: 'find-my-brand', label: 'Find My Brand', category: 'Agents',
    tagline: 'Free brand discovery available without signing in.',
    features: ['Discover your brand look from your site'],
    limits: ['Reachable at #/find-my-brand but not listed in the side menu'],
    intents: ['find my brand colors', 'brand discovery'],
  },
  {
    id: 'website-builder', label: 'Website Builder', category: 'Agents',
    tagline: 'Generate and publish a website from a prompt.',
    features: ['Prompt-to-site builder (opens the Smart Website Builder)'],
    intents: ['build a website', 'landing page', 'publish a site'],
  },
  {
    id: 'render', label: 'Video Render', category: 'Agents',
    tagline: 'Export and render page for finished videos.',
    features: ['Render and export a composition'],
    limits: ['Reachable at #/render but not listed in the side menu'],
    intents: ['export video', 'render final video'],
  },
  {
    id: 'academy', label: 'Smart Video Academy', category: 'Agents',
    tagline: 'Courses and guides for learning the studios.',
    features: ['Lessons and guides'],
    intents: ['learn how to use the app', 'tutorial', 'course'],
  },

  // ── My Work ─────────────────────────────────────────────────────────────
  {
    id: 'library', label: 'Library', category: 'My Work',
    tagline: 'Everything you have generated, in one place.',
    features: ['Browse, reuse and download past generations'],
    intents: ['where are my generations', 'find my old image', 'download my video', 'history'],
  },
  {
    id: 'content-library', label: 'Content', category: 'My Work',
    tagline: 'Browse and reuse your saved content.',
    features: ['Saved content you can reuse across studios'],
    intents: ['saved content', 'reuse my assets'],
  },
];

// App-level facts that are not a studio but people ask about constantly.
export const APP_FACTS = [
  {
    id: 'keys', title: 'API keys (bring your own key)',
    text: 'SmartVideo runs on your own keys. Add your MuAPI key (for image/video/audio generation) and your OpenAI key (for AI chat, Timeline AI and Ask SmartVideo) in Settings → API keys. Keys are sent per request and are never stored on the server. If a studio says it needs a key, open Settings and paste it there.',
    route: 'settings',
    intents: ['api key', 'where do I add my key', 'openai key', 'muapi key', 'it says I need a key', 'settings'],
  },
  {
    id: 'ask', title: 'About Ask SmartVideo',
    text: 'Ask SmartVideo is the in-app help assistant. It answers questions about the studios using the app\'s own documentation, and it links to the right studio. It uses your OpenAI key and cannot generate media itself.',
    intents: ['what is ask smartvideo', 'help assistant', 'how does this chat work'],
  },
  {
    id: 'navigation', title: 'Finding studios',
    text: 'Use the left side menu to switch studios. Groups: Image (Image, Edit, Upscale, Character, Product Shot, Brand), Video (Video, Cinema, Cinema Templates, Storyboard, Effects, AI VFX, Animate, Lip Sync, Video Tools, Avatar, Audio), Agents (Video Agent, Director, Timeline, Workbench, Viral, Personalizer, Website) and My Work (Library, Content). The Apps page lists everything.',
    intents: ['where is the menu', 'how do I switch studios', 'what studios are there'],
  },
];

export const studioRoute = (id) => `#/${id}`;
export const getStudio = (id) => STUDIOS.find((s) => s.id === id) || null;
