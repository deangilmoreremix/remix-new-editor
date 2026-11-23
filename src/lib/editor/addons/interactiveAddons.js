/**
 * Phase 1 interactive addons, re-implemented from the upstream Popcorn
 * plugins. Each descriptor documents the upstream file it replaces.
 */
import { registerAddon } from './registry.js';
import { CTA_LINK_FIELDS, CTA_LINK_DEFAULTS } from './ctaLink.js';

// Toolbar labels, icons and sections match upstream
// lib/generators/toolbarItemsGenerator.js: "Video Controls" (Skip, Pause,
// Loop) and "Lead Generation" (List Builder, Lead Generator), with
// Personalizer and CTA alongside. Icons are upstream's toolbar SVGs, copied
// to public/static/images/toolbar/.
const ICON = (name) => `/static/images/toolbar/${name}.svg`;

// Upstream: lib/popcorn/plugins/pausePlugin + lib/constants/settings/pause.js
// Pauses at start; resumes after `duration` seconds (0 = wait for a click).
export const PAUSE = registerAddon({
  type: 'addon-pause',
  label: 'Pause',
  icon: '⏸️',
  iconSrc: ICON('pause'),
  section: 'Video Controls',
  description: 'Pause the video at this point — for N seconds or until the viewer clicks.',
  behavior: 'pause',
  defaultDuration: 1,
  timing: ['start'],
  // Upstream manifest: Start (default 0.01) + "Pause Duration (0 = forever)" slider.
  defaults: () => ({ duration: 0, continueText: 'Click to continue' }),
  fields: [
    { key: 'duration', label: 'Pause Duration (0 = forever)', type: 'range', min: 0, max: 60, step: 1 },
    { key: 'continueText', label: 'Continue prompt', type: 'text', showIf: (o) => !Number(o.duration) },
  ],
  summary: (o) => `Pause ${Number(o.duration) > 0 ? `${o.duration}s` : 'forever'}`,
});

// Upstream: lib/popcorn/plugins/loopPlugin + lib/constants/settings/loop.js
// When playback reaches the end of the clip, jump back to its start.
export const LOOP = registerAddon({
  type: 'addon-loop',
  label: 'Loop',
  icon: '🔁',
  iconSrc: ICON('loop'),
  section: 'Video Controls',
  description: 'Repeat this section of the video a set number of times, or forever.',
  behavior: 'loop',
  defaultDuration: 4,
  timing: ['start', 'end'],
  // Upstream manifest: Start, End, "Number of loops (0 = forever)" select 0–10, default 0.
  defaults: () => ({ loop: 0 }),
  fields: [
    {
      key: 'loop', label: 'Number of loops (0 = forever)', type: 'select',
      options: Array.from({ length: 11 }, (_, i) => [i, String(i)]),
    },
  ],
  summary: (o) => `Loop: ${Number(o.loop) > 0 ? o.loop : 'forever'}`,
});

// Upstream: lib/popcorn/plugins/skip + lib/constants/settings/skip.js
// Playback entering [start, end) jumps to end. Unlike upstream, the end time
// is read on every tick, so trimming the clip takes effect immediately.
export const SKIP = registerAddon({
  type: 'addon-skip',
  label: 'Skip',
  icon: '⏭️',
  iconSrc: ICON('skip'),
  section: 'Video Controls',
  description: 'Jump over this section of the video during playback.',
  behavior: 'skip',
  defaultDuration: 3,
  timing: ['start', 'end'],
  defaults: () => ({}),
  fields: [],
  summary: () => 'Skip',
});

// Upstream: lib/popcorn/plugins/form (Lead Generator). The page keeps its
// existing rich settings panel and preview for this type (flat options), and
// this descriptor adds the gating behaviour: pause until submit/skip.
export const LEAD_FORM = registerAddon({
  type: 'lead-form',
  label: 'Lead Generator',
  icon: '📝',
  iconSrc: ICON('lead-generator'),
  section: 'Lead Generation',
  description: 'Opt-in form that pauses the video until the viewer submits (or skips).',
  behavior: 'gate',
  flatOptions: true,
  customEditor: true,
  defaultDuration: 5,
  // Upstream lib/constants/settings/lead-generator.js INITIAL_VALUES +
  // popcorn.form.js manifest defaults, mapped onto this editor's lead-form
  // option names.
  defaults: () => ({
    heading: 'Please enter your details to find out more',
    fields: [{ id: 'email', type: 'email', label: 'Email' }],
    ctaText: 'Play',
    privacyText: 'By opting in you are giving us permission to reach out to you concerning this service. We will not share your information or spam.',
    privacyPolicyCaption: '',
    privacyPolicyLink: '',
    brandLogoUrl: '',
    skipButtonEnabled: false,
    webhookEnabled: false,
    webhookUrl: '',
    emailNotificationEnabled: false,
    notificationEmail: '',
    notificationEmail2: '',
    notificationEmail3: '',
    fbPixelId: '',
    gaMeasurementId: '',
    tiktokPixelId: '',
    gtmId: '',
    espProvider: '',
    espListId: '',
    blockDisposableEmails: false,
    successMessage: 'Thanks!',
    afterSubmitAction: 'continue',
    afterSubmitUrl: '',
    afterSubmitButtonText: '',
    style: {
      fontFamily: 'Raleway',
      backgroundColor: '#000000',
      buttonColor: '#eb5054',
      buttonFontColor: '#ffffff',
      buttonBorderRadius: 5,
      buttonBottomBorder: '#eb5054',
      captionAlignment: 'center',
      transition: 'none',
      // Upstream popcorn.form.js manifest defaults: caption / body size in %, text colour, and the inner box.
      captionFontSize: 76,
      fontSize: 60,
      fontColor: '#ffffff',
      innerWidth: 90,
      innerHeight: 90,
      innerColor: '#ffffff',
      innerOpacity: 0,
    },
  }),
});

// Upstream: lib/popcorn/plugins/json-button (CTA). The page keeps its
// existing click-to-call preview/settings; registered so it shows in the
// Interactive panel.
export const CTA_BUTTON = registerAddon({
  type: 'click-to-call',
  label: 'CTA',
  icon: '📞',
  iconSrc: ICON('call-to-action'),
  section: 'Lead Generation',
  description: 'Clickable call-to-action button: dials a phone number or opens a link.',
  flatOptions: true,
  customEditor: true,
  defaultDuration: 4,
  // animation: one of CTA_ANIMATIONS (ctaLottie.js); 'none' = the plain button.
  defaults: () => ({ phoneNumber: '', linkUrl: '', buttonText: 'Call Now', animation: 'pulse', fontFamily: 'Montserrat', textColor: '#ffffff', lottieSrc: '', callNotifyAddress: '', style: { buttonColor: '#eb5054' } }),
});

// Hotspot: an invisible clickable area over the video for a stretch of time.
// It does nothing in the editor or in an MP4 (nothing to click); on the
// published player a viewer's click opens a link, starts a call or jumps to
// another point in the video, and is recorded as an `overlay_click` event.
const hotspotOnly = (field, when) => ({ ...field, showIf: (o) => when(o) && (field.showIf ? field.showIf(o) : true) });
export const HOTSPOT = registerAddon({
  type: 'addon-hotspot',
  label: 'Hotspot',
  icon: '🎯',
  iconSrc: ICON('call-to-action'),
  section: 'Video Controls',
  description: 'A clickable area on the video for viewers: open a link, call a number, or jump to another point. Works on the published link, not in a downloaded MP4.',
  defaultDuration: 5,
  timing: ['start', 'end'],
  positioned: true,
  editorOverlay: true, // drawn as a movable box in the editor (see overlayRender.js buildPlaceholder)
  defaults: () => ({
    label: '',
    action: 'link',
    ...CTA_LINK_DEFAULTS,
    seekTime: 0,
    highlight: false,
    geometry: { left: 35, top: 35, width: 30, height: 30 },
  }),
  fields: [
    { key: 'label', label: 'Label (shown in analytics)', type: 'text', placeholder: 'e.g. Book a demo' },
    { key: 'action', label: 'When clicked', type: 'select', options: [['link', 'Open a link or call a number'], ['seek', 'Jump to a point in the video']] },
    ...CTA_LINK_FIELDS().map((f) => hotspotOnly(f, (o) => o.action !== 'seek')),
    { key: 'seekTime', label: 'Jump to (seconds)', type: 'range', min: 0, max: 600, step: 1, showIf: (o) => o.action === 'seek' },
    { key: 'highlight', label: 'Show an outline on the video', type: 'toggle' },
  ],
  summary: (o) => (o.label ? `Hotspot: ${o.label}` : o.action === 'seek' ? `Hotspot: jump to ${Number(o.seekTime) || 0}s` : 'Hotspot'),
});

// "Choose your path": a card that pauses the video and lets the viewer pick one of 2-4 routes.
// There is no upstream spec, so this is deliberately small: each choice jumps to its `from` time and, when it
// has an `until`, playback jumps on to the shared `thenTime` once it gets there (so routes can rejoin).
export const PATH_CHOICES_MAX = 4;
const choiceFields = Array.from({ length: PATH_CHOICES_MAX }, (_, i) => {
  const n = i + 1;
  // Choices 1-3 are always offered; the fourth appears once the third has a label.
  const on = (o) => n < 4 || String(o.choice3Label || '').trim().length > 0;
  return [
    { key: `choice${n}Label`, label: `Choice ${n}${n > 2 ? ' (optional)' : ''}`, type: 'text', placeholder: n === 1 ? 'e.g. I want pricing' : '', showIf: on },
    { key: `choice${n}From`, label: `Choice ${n} starts at (seconds)`, type: 'range', min: 0, max: 600, step: 1, showIf: on },
    { key: `choice${n}Until`, label: `Choice ${n} ends at (0 = play on)`, type: 'range', min: 0, max: 600, step: 1, showIf: on },
  ];
}).flat();

/** The valid choices of a path-choice clip: [{ label, from, until }] (a choice needs a label). */
export function pathChoices(o = {}) {
  const out = [];
  for (let n = 1; n <= PATH_CHOICES_MAX; n += 1) {
    const label = String(o[`choice${n}Label`] || '').trim().slice(0, 60);
    const from = Number(o[`choice${n}From`]);
    if (!label || !Number.isFinite(from) || from < 0) continue;
    const until = Number(o[`choice${n}Until`]);
    out.push({ label, from, until: Number.isFinite(until) && until > from ? until : 0 });
  }
  return out;
}

export const PATH_CHOICE = registerAddon({
  type: 'addon-path-choice',
  label: 'Choose your path',
  icon: '🔀',
  iconSrc: ICON('call-to-action'),
  section: 'Video Controls',
  description: 'Pause and let the viewer pick a route through the video. Works on the published link.',
  behavior: 'path',
  editorOverlay: true,
  defaultDuration: 5,
  timing: ['start'],
  defaults: () => ({
    heading: 'What would you like to see?', thenTime: 0,
    choice1Label: 'Option A', choice1From: 0, choice1Until: 0,
    choice2Label: 'Option B', choice2From: 0, choice2Until: 0,
    choice3Label: '', choice3From: 0, choice3Until: 0,
    choice4Label: '', choice4From: 0, choice4Until: 0,
  }),
  fields: [
    { key: 'heading', label: 'Question', type: 'text' },
    ...choiceFields,
    { key: 'thenTime', label: 'After a choice ends, continue at (seconds)', type: 'range', min: 0, max: 600, step: 1 },
  ],
  summary: (o) => `Path: ${pathChoices(o).map((c) => c.label).join(' / ') || 'no choices yet'}`,
});

// Upstream order within each toolbar section.
export const INTERACTIVE_ADDONS = [SKIP, PAUSE, LOOP, HOTSPOT, PATH_CHOICE, LEAD_FORM, CTA_BUTTON];

/** Project-level forms (not clips), shown in the Lead Generation section. */
export const PROJECT_FORMS = [
  { kind: 'list-builder', label: 'List Builder', icon: '📋', iconSrc: ICON('listBuilder'), section: 'Lead Generation' },
  { kind: 'personalizer', label: 'Personalizer', icon: '✨', iconSrc: ICON('advanced-optin'), section: 'Lead Generation' },
];
