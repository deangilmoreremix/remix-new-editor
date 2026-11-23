// One-line studio descriptions for the studio-level tooltips (sidebar items, Apps hub cards).
//
// The entries from "image" to "content-library" are copied from the cards in components/AppsHub.js, so the tooltip uses the owner's own
// wording; a test fails if the two drift apart. The entries after them describe hub pages AppsHub has no card for, using only what those
// pages show. A studio with no entry here simply gets no studio-level copy (a test lists them), rather than a guessed description.

export const STUDIO_DESCRIPTIONS = {
  image: { name: 'Image Studio', text: 'Generate images with 20+ AI models' },
  video: { name: 'Video Studio', text: 'Create AI videos from text and images' },
  cinema: { name: 'Cinema Studio', text: 'Cinematic shots with camera controls' },
  animate: { name: 'Animate Studio', text: 'Animate images and create motion graphics' },
  storyboard: { name: 'Storyboard Studio', text: 'Multi-frame generation for sequences' },
  effects: { name: 'Effects Studio', text: 'Apply 200+ motion and visual effects' },
  edit: { name: 'Edit Studio', text: 'Remove objects, backgrounds, reframe' },
  upscale: { name: 'Upscale Suite', text: 'AI upscale and enhance images' },
  character: { name: 'Character Studio', text: 'Consistent character generation' },
  commercial: { name: 'Product Shot Studio', text: 'Studio-quality product photos from one image' },
  viral: { name: 'Smart Video Viral', text: 'AI-powered viral video generation' },
  audio: { name: 'Audio Studio', text: 'Generate music, speech, and sound effects' },
  avatar: { name: 'Avatar Studio', text: 'AI avatars and lip sync video generation' },
  videotools: { name: 'Video Tools', text: 'Upscale, edit, translate, and enhance videos' },
  lipsync: { name: 'Lip Sync Studio', text: 'Animate portraits or sync lips to audio with AI' },
  personalizer: { name: 'Personalizer', text: 'Personalize templates and assets with your data' },
  'video-pages': { name: 'Video Pages', text: 'Turn any video into a branded landing page with a CTA and lead form' },
  'video-agent': { name: 'Video Agent', text: 'AI-powered video production assistant' },
  'ai-vfx': { name: 'AI VFX Studio', text: 'Camera moves, VFX and AI effects from one image' },
  brand: { name: 'Brand Studio', text: 'Brand-consistent content generation' },
  'cinema-template': { name: 'Cinema Templates', text: 'Ready-made cinematic templates: add your media and generate' },
  director: { name: 'Director', text: 'AI editor that cuts and directs your footage' },
  timeline: { name: 'Timeline Editor', text: 'Multi-track timeline for editing and rendering' },
  workbench: { name: 'Workbench', text: 'Node-based workspace to chain generations together' },
  'website-builder': { name: 'Website Builder', text: 'Generate and publish a site from a prompt' },
  library: { name: 'Library', text: 'Everything you have generated, in one place' },
  'content-library': { name: 'Content', text: 'Browse and reuse your saved content' },

  // Hub pages without an AppsHub card (wording taken from what each page shows)
  apps: { name: 'Apps', text: 'Browse every studio and tool in one place.' },
  explore: { name: 'Explore', text: 'Browse example prompts and try them.' },
  templates: { name: 'Templates', text: 'Browse ready-made templates and start from one.' },
  academy: { name: 'Academy', text: 'Courses and guides for using the studios.' },
  render: { name: 'Video Render', text: 'Render and export your video.' },
  leadfinder: { name: 'Lead Finder', text: 'Find businesses and save the prospects you like.' },
  settings: { name: 'Settings', text: 'Your API key and preferences.' },
  monetize: { name: 'Monetize', text: 'Open the Smart Video AI Monetization Hub.' },
};
