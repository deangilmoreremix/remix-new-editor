// Ask SmartVideo: which Academy tracks/lessons are worth suggesting per studio.
// Plain data, no imports. Every track/lesson below exists under src/content/academy.

// Verified deep-link form (src/components/academy/AcademyPage.jsx parseAcademyHash / buildAcademyHash):
//   #/academy/track/<trackFolderSlug>                      -> track page
//   #/academy/track/<trackFolderSlug>/lesson/<lessonId>    -> lesson page
// lessonId (catalog.js ACADEMY_LESSONS[].id): track 01 uses the file slug WITHOUT the NN- prefix
// (e.g. 'how-ugc-works'); tracks 02..15 use '<trackFolderSlug>::<NN-file-slug>'.
// NOT query params. Use academyLessonUrl()/academyTrackUrl() below.
export const ACADEMY_URL_FORMAT =
  '#/academy/track/<trackSlug>/lesson/<lessonId>; lessonId = file slug minus "NN-" for track 01, else "<trackSlug>::<NN-file-slug>"';

export function academyTrackUrl(track) {
  return `#/academy/track/${track}`;
}

export function academyLessonUrl(track, lesson) {
  const id = track === '01-ai-video-ads-ugc' ? String(lesson).replace(/^\d+-/, '') : `${track}::${lesson}`;
  return `#/academy/track/${track}/lesson/${id}`;
}

export const TRACK_TITLES = {
  '01-ai-video-ads-ugc': 'AI Video Ads & UGC',
  '02-ai-filmmaking': 'AI Filmmaking',
  '03-faceless-ai-channels': 'Faceless AI Channels',
  '04-ai-content-factories': 'AI Content Factories',
  '05-ai-avatars-and-influencers': 'AI Avatars & Influencers',
  '06-ai-audio-and-music': 'AI Audio & Music',
  '07-ai-product-photography': 'AI Product Photography & E-commerce',
  '08-ai-fashion-and-virtual-tryon': 'AI Fashion & Virtual Try-On',
  '09-ai-real-estate-staging': 'AI Real Estate (Virtual Staging)',
  '10-ai-headshots-and-portraits': 'AI Headshots & Portraits',
  '11-ai-print-on-demand-and-merch': 'AI Print-on-Demand & Merch Design',
  '12-ai-stock-content-and-licensing': 'AI Stock Content & Licensing',
  '13-ai-tools-mastery': 'AI Tools Mastery',
  '14-ai-freelancing-and-agency-business': 'AI Freelancing & Agency Business',
  '15-ai-agents-and-vibe-coding': 'AI Agents & Vibe-Coding for Creators',
};

const T01 = '01-ai-video-ads-ugc';
const T02 = '02-ai-filmmaking';
const T03 = '03-faceless-ai-channels';
const T04 = '04-ai-content-factories';
const T05 = '05-ai-avatars-and-influencers';
const T06 = '06-ai-audio-and-music';
const T07 = '07-ai-product-photography';
const T08 = '08-ai-fashion-and-virtual-tryon';
const T09 = '09-ai-real-estate-staging';
const T10 = '10-ai-headshots-and-portraits';
const T11 = '11-ai-print-on-demand-and-merch';
const T12 = '12-ai-stock-content-and-licensing';
const T13 = '13-ai-tools-mastery';
const T14 = '14-ai-freelancing-and-agency-business';

export const STUDIO_ACADEMY = {
  image: {
    tracks: [T13, T11],
    lessons: [
      { track: T13, lesson: '01-image-models-which-one-for-which-use-case', why: 'Helps you pick the right image model for your goal.' },
      { track: T11, lesson: '01-designing-sellable-ai-art-for-merch', why: 'Prompting and upscaling AI art so it looks good in print.' },
      { track: T10, lesson: '01-consistent-headshot-generation', why: 'Prompting for consistent, realistic portraits.' },
    ],
  },
  edit: {
    tracks: [T08, T09],
    lessons: [
      { track: T08, lesson: '01-garment-tryon', why: 'Swap garments on a model photo, like the Change Dress tool.' },
      { track: T09, lesson: '01-empty-room-to-staged-room', why: 'Edit a room photo into a furnished one.' },
      { track: T07, lesson: '01-product-photography', why: 'Clean backgrounds and polished product images.' },
    ],
  },
  upscale: {
    tracks: [T12],
    lessons: [
      { track: T12, lesson: '02-batch-generating-a-licensable-catalog', why: 'Upscaling images to the resolution buyers expect.' },
      { track: T11, lesson: '01-designing-sellable-ai-art-for-merch', why: 'Upscaling art to print resolution.' },
    ],
  },
  character: {
    tracks: [T05, T01],
    lessons: [
      { track: T05, lesson: '01-consistent-character', why: 'Keep the same face and look across images.' },
      { track: T01, lesson: '02-character-consistency', why: 'Stop the character drifting between scenes and ads.' },
      { track: T05, lesson: '02-character-content-pipeline', why: 'Turn one character into a steady stream of content.' },
    ],
  },
  commercial: {
    tracks: [T07],
    lessons: [
      { track: T07, lesson: '01-product-photography', why: 'Product shots without a photographer.' },
      { track: T07, lesson: '04-batch-workflows', why: 'Run a whole catalog through the same look.' },
      { track: T07, lesson: '02-conversion-case-studies', why: 'See before/after results that raise conversions.' },
    ],
  },
  brand: {
    tracks: [T14],
    lessons: [
      { track: T14, lesson: '05-building-a-portfolio-that-sells', why: 'Show brand work in a portfolio clients trust.' },
      { track: T01, lesson: '03-building-an-ad-batch', why: 'Make a consistent batch of ads for one brand.' },
    ],
  },
  influencer: {
    tracks: [T05],
    lessons: [
      { track: T05, lesson: '01-consistent-character', why: 'Build a virtual influencer with a stable look.' },
      { track: T05, lesson: '02-character-content-pipeline', why: 'Go from character to posts and videos.' },
      { track: T05, lesson: '04-monetization-tiers', why: 'How virtual influencers earn at different follower counts.' },
    ],
  },
  video: {
    tracks: [T13, T01],
    lessons: [
      { track: T13, lesson: '02-video-models-which-one-for-which-use-case', why: 'Choose the right video model for the shot.' },
      { track: T01, lesson: '01-how-ugc-works', why: 'How AI UGC-style clips are made end to end.' },
      { track: T02, lesson: '03-camera-movement', why: 'Prompt camera motion that actually shows up.' },
    ],
  },
  cinema: {
    tracks: [T02],
    lessons: [
      { track: T02, lesson: '03-camera-movement', why: 'Camera movement and cinematography prompts.' },
      { track: T02, lesson: '02-storyboarding-and-shots', why: 'Plan the shots before you generate.' },
      { track: T02, lesson: '04-assembling-short-film', why: 'Put cinematic shots together into a film.' },
    ],
  },
  'cinema-template': {
    tracks: [T02],
    lessons: [
      { track: T02, lesson: '03-camera-movement', why: 'Understand the camera moves the templates use.' },
      { track: T02, lesson: '02-storyboarding-and-shots', why: 'Plan shots around a template scene.' },
    ],
  },
  storyboard: {
    tracks: [T02],
    lessons: [
      { track: T02, lesson: '02-storyboarding-and-shots', why: 'Storyboarding and shot planning.' },
      { track: T02, lesson: '01-screenplay-and-story', why: 'Write the story you are about to board.' },
      { track: T02, lesson: '04-assembling-short-film', why: 'Turn boarded shots into a finished short.' },
    ],
  },
  effects: { tracks: [], lessons: [] },
  'ai-vfx': { tracks: [], lessons: [] },
  animate: {
    tracks: [T02],
    lessons: [
      { track: T02, lesson: '03-camera-movement', why: 'Describe motion so a still image moves the way you want.' },
    ],
  },
  lipsync: {
    tracks: [T05, T06],
    lessons: [
      { track: T05, lesson: '02-character-content-pipeline', why: 'Lip-sync a character to dialogue.' },
      { track: T05, lesson: '03-voice-cloning-dialogue', why: 'Create the voice and dialogue to sync to.' },
      { track: T06, lesson: '02-dubbing-translation', why: 'Dub and translate videos in other languages.' },
    ],
  },
  videotools: {
    tracks: [T06],
    lessons: [
      { track: T06, lesson: '02-dubbing-translation', why: 'Translate and dub a video.' },
      { track: T04, lesson: '02-tiktok-reels-factory', why: 'Prep short vertical clips at volume.' },
    ],
  },
  avatar: {
    tracks: [T05, T01],
    lessons: [
      { track: T05, lesson: '01-consistent-character', why: 'Design an avatar that looks the same every time.' },
      { track: T05, lesson: '03-voice-cloning-dialogue', why: 'Give your avatar a voice.' },
      { track: T01, lesson: '01-how-ugc-works', why: 'Presenter-style videos that work as ads.' },
    ],
  },
  audio: {
    tracks: [T06],
    lessons: [
      { track: T06, lesson: '01-voice-cloning-tts', why: 'Text-to-speech and voice basics.' },
      { track: T06, lesson: '04-music-sfx-generation', why: 'Generate music and sound effects.' },
      { track: T13, lesson: '03-voice-audio-models-which-one-for-which-use-case', why: 'Pick the right voice or audio model.' },
    ],
  },
  'video-agent': { tracks: [], lessons: [] },
  'motion-director': { tracks: [], lessons: [] },
  director: { tracks: [], lessons: [] },
  timeline: {
    tracks: [T02],
    lessons: [
      { track: T02, lesson: '04-assembling-short-film', why: 'Assemble clips, sound and music into a finished video.' },
      { track: T03, lesson: '02-narration-and-pacing', why: 'Match narration length to your cuts.' },
    ],
  },
  workbench: { tracks: [], lessons: [] },
  viral: {
    tracks: [T04],
    lessons: [
      { track: T04, lesson: '02-tiktok-reels-factory', why: 'Make short-form videos for TikTok and Reels.' },
      { track: T04, lesson: '03-youtube-shorts-factory', why: 'Make YouTube Shorts that loop and hold attention.' },
      { track: T03, lesson: '01-niche-and-script', why: 'Pick a niche and write scripts that hold viewers.' },
    ],
  },
  personalizer: {
    tracks: [T01],
    lessons: [
      { track: T01, lesson: '03-building-an-ad-batch', why: 'Produce many variations from one template.' },
    ],
  },
  leadfinder: {
    tracks: [T14],
    lessons: [
      { track: T14, lesson: '03-finding-and-closing-clients', why: 'Find and win clients for your services.' },
      { track: T09, lesson: '03-selling-to-realtors-and-agencies', why: 'Example of selling to a specific local niche.' },
    ],
  },
  'find-my-brand': { tracks: [], lessons: [] },
  'website-builder': { tracks: [], lessons: [] },
  render: { tracks: [], lessons: [] },
  library: { tracks: [], lessons: [] },
  'content-library': { tracks: [], lessons: [] },
  apps: { tracks: [], lessons: [] },
  explore: { tracks: [], lessons: [] },
  templates: {
    tracks: [T01],
    lessons: [
      { track: T01, lesson: '03-building-an-ad-batch', why: 'Reusable ad templates and a batch matrix.' },
    ],
  },
};
