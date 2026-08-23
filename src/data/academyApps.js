const APPS_DATA = {
  '01-ai-video-ads-ugc': {
    'how-ugc-works': { status: 'existing', repo_link: 'https://github.com/Anil-matcha/awesome-generative-ai-apps/tree/main/video_generation/Open-AI-UGC' },
    'character-consistency': { status: 'needed', repo_link: null },
    'building-an-ad-batch': { status: 'needed', repo_link: null },
    'case-study-teardown': { status: 'needed', repo_link: null },
  },
  '02-ai-filmmaking': {
    '02-ai-filmmaking::01-screenplay-and-story': { status: 'needed', repo_link: null },
    '02-ai-filmmaking::02-storyboarding-and-shots': { status: 'needed', repo_link: null },
    '02-ai-filmmaking::03-camera-movement': { status: 'needed', repo_link: null },
    '02-ai-filmmaking::04-assembling-short-film': { status: 'existing', repo_link: 'https://github.com/Anil-matcha/awesome-generative-ai-apps/tree/main/video_generation/Open-AI-Micro-Drama-Generator' },
    '02-ai-filmmaking::05-selling-short-films': { status: 'needed', repo_link: null },
  },
  '03-faceless-ai-channels': {
    '03-faceless-ai-channels::01-niche-and-script': { status: 'needed', repo_link: null },
    '03-faceless-ai-channels::02-narration-and-pacing': { status: 'existing', repo_link: 'https://github.com/Anil-matcha/awesome-generative-ai-apps/tree/main/video_generation/AI-Youtube-Shorts-Generator' },
    '03-faceless-ai-channels::03-rpm-and-earnings': { status: 'needed', repo_link: null },
    '03-faceless-ai-channels::04-scaling-channels': { status: 'existing', repo_link: 'https://github.com/Anil-matcha/awesome-generative-ai-apps/tree/main/video_generation/ai-clipping-generator' },
    '03-faceless-ai-channels::05-monetization-ladder': { status: 'needed', repo_link: null },
  },
  '04-ai-content-factories': {
    '04-ai-content-factories::01-production-pipeline': { status: 'existing', repo_link: 'https://github.com/Anil-matcha/awesome-generative-ai-apps/tree/main/video_generation/AI-Youtube-Shorts-Generator' },
    '04-ai-content-factories::02-tiktok-reels-factory': { status: 'needed', repo_link: null },
    '04-ai-content-factories::03-youtube-shorts-factory': { status: 'existing', repo_link: 'https://github.com/Anil-matcha/awesome-generative-ai-apps/tree/main/video_generation/AI-Youtube-Shorts-Generator' },
    '04-ai-content-factories::04-thumbnail-design': { status: 'needed', repo_link: null },
    '04-ai-content-factories::05-batching-and-scheduling': { status: 'existing', repo_link: 'https://github.com/Anil-matcha/awesome-generative-ai-apps/tree/main/video_generation/ai-clipping-generator' },
    '04-ai-content-factories::06-selling-content-services': { status: 'needed', repo_link: null },
  },
  '05-ai-avatars-and-influencers': {
    '05-ai-avatars-and-influencers::01-consistent-character': { status: 'existing', repo_link: 'https://github.com/Anil-matcha/awesome-generative-ai-apps/tree/main/portrait_avatar/ai-character-studio' },
    '05-ai-avatars-and-influencers::02-character-content-pipeline': { status: 'needed', repo_link: null },
    '05-ai-avatars-and-influencers::03-voice-cloning-dialogue': { status: 'needed', repo_link: null },
    '05-ai-avatars-and-influencers::04-monetization-tiers': { status: 'needed', repo_link: null },
    '05-ai-avatars-and-influencers::05-agency-economics': { status: 'needed', repo_link: null },
  },
  '06-ai-audio-and-music': {
    '06-ai-audio-and-music::01-voice-cloning-tts': { status: 'needed', repo_link: null },
    '06-ai-audio-and-music::02-dubbing-translation': { status: 'needed', repo_link: null },
    '06-ai-audio-and-music::03-podcast-production': { status: 'needed', repo_link: null },
    '06-ai-audio-and-music::04-music-sfx-generation': { status: 'needed', repo_link: null },
    '06-ai-audio-and-music::05-singing-vocal-synthesis': { status: 'needed', repo_link: null },
  },
  '07-ai-product-photography': {
    track_id: '07-ai-product-photography',
    track_name: 'AI Product Photography & E-commerce',
    app_mapping: {
      '07-ai-product-photography::01-product-photography': { app_id: 'ai-product-photography-studio', app_name: 'AI Product Studio', path: '/studios/product-photo-studio' },
      '07-ai-product-photography::02-conversion-case-studies': { app_id: 'ai-product-photography-studio', app_name: 'AI Product Studio', path: '/studios/product-photo-studio' },
      '07-ai-product-photography::03-productized-service': { app_id: 'ai-product-photography-studio', app_name: 'AI Product Studio', path: '/studios/product-photo-studio' },
      '07-ai-product-photography::04-batch-workflows': { app_id: 'ai-product-photography-studio', app_name: 'AI Product Studio', path: '/studios/product-photo-studio' },
    },
  },
  '08-ai-fashion-and-virtual-tryon': {
    track_id: '08-ai-fashion-and-virtual-tryon',
    track_name: 'AI Fashion & Virtual Try-On',
    app_mapping: {
      '08-ai-fashion-and-virtual-tryon::01-garment-tryon': { app_id: 'ai-fashion-studio', app_name: 'AI Fashion Studio', path: '/studios/fashion-studio' },
      '08-ai-fashion-and-virtual-tryon::02-studio-lookbooks': { app_id: 'ai-fashion-studio', app_name: 'AI Fashion Studio', path: '/studios/fashion-studio' },
      '08-ai-fashion-and-virtual-tryon::03-sizing-layout-consistency': { app_id: 'ai-fashion-studio', app_name: 'AI Fashion Studio', path: '/studios/fashion-studio' },
      '08-ai-fashion-and-virtual-tryon::04-conversion-cases': { app_id: 'ai-fashion-studio', app_name: 'AI Fashion Studio', path: '/studios/fashion-studio' },
    },
  },
};

export function getAppsForTrack(trackSlug) {
  return APPS_DATA[trackSlug] || null;
}

export function getAppForLesson(trackSlug, lessonId) {
  const apps = APPS_DATA[trackSlug];
  if (!apps) return null;

  // Old format (tracks 01-06): lessonId is a direct key
  if (apps[lessonId]) {
    return { format: 'repo', ...apps[lessonId] };
  }

  // New format (tracks 07-08): lessonId is in app_mapping
  if (apps.app_mapping && apps.app_mapping[lessonId]) {
    const mapping = apps.app_mapping[lessonId];
    return { format: 'studio', ...mapping, path: mapping.path, pageId: mapping.path.replace(/^\//, '') };
  }

  return null;
}

export function getTrackAppName(trackSlug) {
  const apps = APPS_DATA[trackSlug];
  if (!apps) return null;
  if (apps.track_name) return apps.track_name;
  // For old format, derive from lessons
  const existing = Object.entries(apps).find(([_, info]) => info.status === 'existing' && info.repo_link);
  if (existing) return 'Generated App';
  return null;
}
