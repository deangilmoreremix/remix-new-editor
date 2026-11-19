// Per-feature screenshot targets for tests/e2e/guide-screenshots.spec.js.
//
// The spec finds most features on its own by matching the feature name against
// visible controls in the studio. Add an entry here when it picks the wrong
// control or none at all:
//
//   '<guide slug>': {
//     '<feature id>': { text: 'Visible label' }            highlight the control with this text
//     '<feature id>': { selector: 'css selector' }         highlight this element
//     '<feature id>': { ..., click: true }                 click it first (tabs, dropdowns, panels)
//     '<feature id>': { route: 'campaign' }                the feature is its own page: screenshot #/campaign
//     '<feature id>': { route: '...', text: 'Tab' }        open that page, then find the control there
//     '<feature id>': { skip: true }                       no own shot; the guide uses the overview
//   }
//
// Feature ids are the slugified feature names (see studioGuides.core.js).
export const TARGETS = {
  'image-studio': {
    'text-to-image': { text: 'Describe the image you want to create', selector: 'textarea' },
    'model-picker': { text: 'Nano Banana', click: true },
  },
  'brand-studio': {
    'brand-dna-editor': { route: 'brand-dna' },
    'campaign-studio': { route: 'campaign' },
    'asset-editor': { route: 'asset-edit' },
    'photo-studio': { route: 'photo-studio' },
    'photo-studio-generation-mode-brand-api-direct-muapi': { route: 'brand-photo-studio' },
  },
  'video-studio': {
    'animate-image-image-to-video': { route: 'image-to-video' },
  },
  'smart-video-academy': {
    'track-page': { route: 'academy/track/01-ai-video-ads-ugc' },
    'lesson-page-learn-tab': { route: 'academy/track/01-ai-video-ads-ugc/lesson/how-ugc-works', text: 'Learn', click: true },
    'lesson-page-see-tab': { route: 'academy/track/01-ai-video-ads-ugc/lesson/how-ugc-works', text: 'See', click: true },
    'lesson-page-create-tab': { route: 'academy/track/01-ai-video-ads-ugc/lesson/how-ugc-works', text: 'Create', click: true },
    'copy-link-share-a-lesson': { route: 'academy/track/01-ai-video-ads-ugc/lesson/how-ugc-works', text: 'Copy link' },
    'track-01-ai-video-ads-ugc-ai-video-ads-and-ugc-5-lessons-7-templates': { route: 'academy/track/01-ai-video-ads-ugc' },
    'track-02-02-ai-filmmaking-ai-filmmaking-5-lessons-10-templates': { route: 'academy/track/02-ai-filmmaking' },
    'track-03-03-faceless-ai-channels-faceless-ai-channels-5-lessons-7-templates': { route: 'academy/track/03-faceless-ai-channels' },
    'track-04-04-ai-content-factories-ai-content-factories-6-lessons-8-templates': { route: 'academy/track/04-ai-content-factories' },
    'track-05-05-ai-avatars-and-influencers-ai-avatars-and-influencers-5-lessons-5-templates': { route: 'academy/track/05-ai-avatars-and-influencers' },
    'track-06-06-ai-audio-and-music-ai-audio-and-music-5-lessons-5-templates': { route: 'academy/track/06-ai-audio-and-music' },
    'track-07-07-ai-product-photography-ai-product-photography-and-e-commerce-4-lessons-4-templates': { route: 'academy/track/07-ai-product-photography' },
    'track-08-08-ai-fashion-and-virtual-tryon-ai-fashion-and-virtual-try-on-4-lessons-4-templates': { route: 'academy/track/08-ai-fashion-and-virtual-tryon' },
    'track-09-09-ai-real-estate-staging-ai-real-estate-virtual-staging-3-lessons-3-templates': { route: 'academy/track/09-ai-real-estate-staging' },
    'track-10-10-ai-headshots-and-portraits-ai-headshots-and-portraits-4-lessons-4-templates': { route: 'academy/track/10-ai-headshots-and-portraits' },
    'track-11-11-ai-print-on-demand-and-merch-ai-print-on-demand-and-merch-design-4-lessons-4-templates': { route: 'academy/track/11-ai-print-on-demand-and-merch' },
    'track-12-12-ai-stock-content-and-licensing-ai-stock-content-and-licensing-3-lessons-4-templates': { route: 'academy/track/12-ai-stock-content-and-licensing' },
    'track-13-13-ai-tools-mastery-ai-tools-mastery-4-lessons-4-templates': { route: 'academy/track/13-ai-tools-mastery' },
    'track-14-14-ai-freelancing-and-agency-business-ai-freelancing-and-agency-business-5-lessons-4-templates': { route: 'academy/track/14-ai-freelancing-and-agency-business' },
    'track-15-15-ai-agents-and-vibe-coding-ai-agents-and-vibe-coding-for-creators-4-lessons-4-templates': { route: 'academy/track/15-ai-agents-and-vibe-coding' },
  },
};

// Studios that can't render without services the capture machine may not have
// (the built OpenThorn app, a Supabase project). Their guides use the studio's
// existing thumbnail. Capture them explicitly with GUIDES=<slug> when available.
export const SKIP_STUDIOS = ['website-builder', 'video-pages'];

// Never click controls whose label matches this: they spend credits, change
// data, open file dialogs or leave the page.
export const DANGEROUS = /generate|create|delete|remove|publish|send|buy|purchase|download|upload|submit|sign|log ?out|clear|reset|render|export|save|record|start|run\b|apply|post\b|share|connect|pay|subscribe|cancel|launch|deploy|import|train|enhance|upscale|animate|sync|dub|translate|swap|make|build/i;
