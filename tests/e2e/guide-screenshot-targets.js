import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
// Targets live in tests/e2e/guide-targets/<guide slug>.json, one file per studio:
//   { "<feature id>": { ...target } }
// Extra keys for features that need more than a click:
//     "steps": [{ "text": "Label" }, { "selector": "css", "wait": 1500 }]
//                                                       clicks to run first (menus, sub-tabs, wizard steps);
//                                                       with no text/selector the result itself is the shot
//     "__overview": { "setup": "..." }                  (guide level) seed state before the overview shot
//     "setup": "js expression"                          run in the page first (e.g. seed a sample result in
//                                                       localStorage), then the studio is reloaded
//                                                       ("reload": false to skip the reload)
//     "selector" may also be a whole region (a panel or section) to highlight.
const TARGET_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'guide-targets');
export const TARGETS = Object.fromEntries(
  fs.existsSync(TARGET_DIR)
    ? fs.readdirSync(TARGET_DIR).filter((f) => f.endsWith('.json'))
      .map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(TARGET_DIR, f), 'utf8'))])
    : [],
);

// Studios that can't render without services the capture machine may not have
// (the built OpenThorn app, a Supabase project). Their guides use the studio's
// existing thumbnail. Capture them explicitly with GUIDES=<slug> when available.
export const SKIP_STUDIOS = ['website-builder', 'video-pages'];

// Never click controls whose label matches this: they spend credits, change
// data, open file dialogs or leave the page.
export const DANGEROUS = /generate|create|delete|remove|publish|send|buy|purchase|download|upload|submit|sign|log ?out|clear|reset|render|export|save|record|start|run\b|apply|post\b|share|connect|pay|subscribe|cancel|launch|deploy|import|train|enhance|upscale|animate|sync|dub|translate|swap|make|build/i;
