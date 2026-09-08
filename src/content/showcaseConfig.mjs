// SmartVideo AI Landing Page Showcase Configuration
// Maps current landing page sections to historical visual assets
// All assets reference existing files in public/thumbnails/ and public/assets/

const SHOWCASE_CONFIG = {
  studioThumbnails: {
    image: '/thumbnails/studios/image.webp',
    video: '/thumbnails/studios/video.webp',
    cinema: '/thumbnails/studios/cinema.webp',
    character: '/thumbnails/studios/character.webp',
    'ai-vfx': '/thumbnails/studios/vfx.webp',
    influencer: '/thumbnails/studios/influencer.webp',
    storyboard: '/thumbnails/studios/storyboard.webp',
    effects: '/thumbnails/studios/effects.webp',
    vfx: '/thumbnails/studios/vfx.webp',
    edit: '/thumbnails/studios/edit.webp',
    upscale: '/thumbnails/studios/upscale.webp',
    audio: '/thumbnails/studios/audio.webp',
    avatar: '/thumbnails/studios/avatar.webp',
    training: '/thumbnails/studios/training.webp',
    videotools: '/thumbnails/studios/videotools.webp',
    render: '/thumbnails/heroes/render.webp.png',
    videoAgent: '/thumbnails/heroes/videoagent.webp.png',
    director: '/thumbnails/videoagent/overview.png',
    timeline: '/thumbnails/heroes/timeline.webp.png',
    motion: '/thumbnails/videoagent/effects-motion.webp.png',
    tiktok: '/thumbnails/categories/social.webp',
    dubbing: '/thumbnails/videoagent/audio-whisper.webp.png',
    chat: '/thumbnails/studios/chat.webp.png',
    commercial: '/thumbnails/studios/commercial.webp',
    templates: '/thumbnails/pages/templates.webp.png',
    explore: '/thumbnails/pages/explore.webp.png',
    library: '/thumbnails/pages/library.webp',
    community: '/thumbnails/pages/community.webp',
    assist: '/thumbnails/pages/assist.webp',
    lipSync: '/thumbnails/heroes/lipsync.webp.png',
    workflows: '/thumbnails/videoagent/commentary.png',
    agents: '/thumbnails/videoagent/audio-tts.webp.png',
    mcpCli: '/thumbnails/videoagent/tab-edit.png'
  },

  toolThumbnails: {
    aiEdit: '/thumbnails/tools/ai-edit.webp',
    colorize: '/thumbnails/tools/colorize.webp',
    dressChange: '/thumbnails/tools/dress-change.webp',
    extend: '/thumbnails/tools/extend.webp',
    faceSwap: '/thumbnails/tools/face-swap.webp',
    ghibliStyle: '/thumbnails/tools/ghibli-style.webp',
    productShot: '/thumbnails/tools/product-shot.webp',
    reframe: '/thumbnails/tools/reframe.webp',
    removeBg: '/thumbnails/tools/remove-bg.webp',
    removeObject: '/thumbnails/tools/remove-object.webp',
    skinEnhance: '/thumbnails/tools/skin-enhance.webp',
    upscale: '/thumbnails/tools/upscale.webp',
    watermark: '/thumbnails/tools/watermark.webp'
  },

  categoryThumbnails: {
    camera: '/thumbnails/categories/camera.webp',
    commercial: '/thumbnails/categories/commercial.webp',
    decade: '/thumbnails/categories/decade.webp',
    entertainment: '/thumbnails/categories/entertainment.webp',
    portrait: '/thumbnails/categories/portrait.webp',
    social: '/thumbnails/categories/social.webp',
    style: '/thumbnails/categories/style.webp',
    vfx: '/thumbnails/categories/vfx.webp'
  },

  sampleMedia: {
    sampleVideo: '/sample-video.mp4',
    docsDemo: '/docs/assets/demo.mp4',
    generatedExample: '/docs/assets/generated_example.webp',
    studioDemo: '/docs/assets/studio_demo.webp'
  },

  templateThumbnails: {
    restaurant: '/thumbnails/templates/restaurant.webp.png',
    cafe: '/thumbnails/templates/cafe.webp.png',
    medspa: '/thumbnails/templates/medspa-transformation-story.webp.png',
    beauty: '/thumbnails/templates/beauty.webp.png',
    salon: '/thumbnails/templates/salon_transformation_story.webp.png',
    barbershop: '/thumbnails/templates/barbershop.webp.png',
    realEstate: '/thumbnails/templates/real-estate.webp.png',
    automotive: '/thumbnails/templates/automotive.webp.png',
    fitness: '/thumbnails/templates/fitness_transformation.webp.png',
    fashion: '/thumbnails/templates/fashion.webp.png',
    luxury: '/thumbnails/templates/luxury.webp.png',
    dental: '/thumbnails/templates/dental.webp.png',
    legal: '/thumbnails/templates/legal.webp.png',
    events: '/thumbnails/templates/events.webp.png',
    superheroTransform: '/thumbnails/templates/superhero-transform.webp'
  },

  effectPreviews: {
    kontext: {
      objectRemoval: '/thumbnails/effects/kontext-effects/object-removal.webp.png',
      backgroundChange: '/thumbnails/effects/kontext-effects/background-change.webp.png',
      cartoonify: '/thumbnails/effects/kontext-effects/cartoonify.webp.png',
      colorCorrection: '/thumbnails/effects/kontext-effects/color-correction.webp.png',
      faceEnhancement: '/thumbnails/effects/kontext-effects/face-enhancement.webp.png',
      styleTransfer: '/thumbnails/effects/kontext-effects/style-transfer.webp.png',
      professionalPhoto: '/thumbnails/effects/kontext-effects/professional-photo.webp.png',
      ageProgression: '/thumbnails/effects/kontext-effects/age-progression.webp.png'
    },
    vfx: {
      buildingExplosion: '/thumbnails/effects/vfx/building-explosion.webp.png',
      carExplosion: '/thumbnails/effects/vfx/car-explosion.webp.png',
      electricity: '/thumbnails/effects/vfx/electricity.webp.png',
      disintegration: '/thumbnails/effects/vfx/disintegration.webp.png',
      flying: '/thumbnails/effects/vfx/flying.webp.png',
      levitate: '/thumbnails/effects/vfx/levitate.webp.png',
      tornado: '/thumbnails/effects/vfx/tornado.webp.png',
      pixelMe: '/thumbnails/effects/vfx/pixel-me.webp.png'
    },
    motionControls: {
      dollyIn: '/thumbnails/effects/motion-controls/dolly-in.webp.png',
      craneUp: '/thumbnails/effects/motion-controls/crane-up.webp.png',
      zoomIn: '/thumbnails/effects/motion-controls/zoom-in.webp.png',
      whipPan: '/thumbnails/effects/motion-controls/whip-pan.webp.png',
      droneCam: '/thumbnails/effects/motion-controls/fpv-drone-cam.webp.png',
      orbit360: '/thumbnails/effects/motion-controls/360-orbit.webp.png'
    }
  },

  getStudioThumbnail: function(id) {
    return this.studioThumbnails[id] || '/thumbnails/studios/video.webp';
  },

  getToolThumbnail: function(id) {
    return this.toolThumbnails[id] || null;
  },

  getTemplateThumbnail: function(niche) {
    return this.templateThumbnails[niche] || null;
  },

  getEffectPreview: function(category, name) {
    const cat = this.effectPreviews[category];
    return cat ? (cat[name] || null) : null;
  }
};

export default SHOWCASE_CONFIG;
