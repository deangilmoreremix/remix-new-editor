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
};

// Never click controls whose label matches this: they spend credits, change
// data, open file dialogs or leave the page.
export const DANGEROUS = /generate|create|delete|remove|publish|send|buy|purchase|download|upload|submit|sign|log ?out|clear|reset|render|export|save|record|start|run\b|apply|post\b|share|connect|pay|subscribe|cancel|launch|deploy|import|train|enhance|upscale|animate|sync|dub|translate|swap|make|build/i;
