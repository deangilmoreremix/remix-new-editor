/**
 * Opt-in form: List Builder / Personalizer / Lead Generator — ONE design.
 *
 * Re-implemented from upstream strategic-limited/remix-new-editor:
 *   lib/popcorn/plugins/retarget/popcorn.retarget.js (Popcorn.compose('retargetForm'))
 *   lib/popcorn/plugins/form/popcorn.form.js          (Popcorn.plugin('form') = Lead Generator)
 *   lib/constants/settings/retarget-settings.js        (DEFAULT_OPTIONS, ARRAY_ELEMENTS_RETARGET, ARRAY_TRANSITIONS)
 *   lib/constants/settings/advanced-optin.js           (Personalizer = isPersonalizer: true)
 *
 * Upstream built the SAME form markup in both plugins; only the defaults and
 * the timing differ:
 *   - List Builder / Personalizer: project-level, shown at the start of the
 *     video and holding playback until the viewer submits (or skips).
 *   - Lead Generator: a timed clip placed anywhere in the video; it pauses at
 *     its start and resumes on submit / skip, and never shows again.
 * Here all three share this schema, the renderer in ./addonOverlay.js and the
 * settings panel. Everything visible is an option (including the Play button
 * colours, the input styling, the backdrop and the pointer arrow + bubble).
 *
 * The Lead Generator clip keeps its original stored shape (heading, ctaText,
 * style.buttonColor, …) so saved projects, the lead-capture backend and the
 * AI prompts keep working: leadFormToOptin / applyOptinToLeadForm adapt
 * between that shape and this schema.
 *
 * Personalizer: no Integrations tab, no privacy disclaimer; answers are
 * written into the personalization profile store so {{first_name}} tokens in
 * the rest of the video resolve to them.
 */
import {
  POINTER_DESIGNS, POINTER_THEMES, POINTER_CATEGORIES, POINTER_MOTIONS, TARGET_MOTIONS, HINT_STYLES, HINT_POSITIONS, pointerSvg, isTargetDesign,
} from './pointerDesigns.js';
import { leadFieldTokens, ESP_PROVIDERS, espName, espListLabel } from './leadClient.js';
import { FIELD_LAYOUTS } from './addonOverlay.js';

export const LIST_BUILDER_KINDS = {
  'list-builder': 'List Builder',
  personalizer: 'Personalizer',
};

export const OPTIN_KINDS = {
  ...LIST_BUILDER_KINDS,
  'lead-generator': 'Lead Generator',
};

// Upstream ARRAY_ELEMENTS_RETARGET
export const FORM_FIELD_TYPES = [
  ['singleline', 'Singleline'],
  ['multiline', 'Multiline'],
  ['email', 'Email'],
  ['number', 'Number'],
  ['date', 'Date'],
];

/** The Lead Generator clip also offered a Phone field. */
export const LEAD_FIELD_TYPES = [...FORM_FIELD_TYPES, ['phone', 'Phone']];

// Upstream ARRAY_TRANSITIONS (full list).
export const FORM_TRANSITIONS = [
  ['popcorn-none', 'None'],
  ['popcorn-pop', 'Pop'],
  ['popcorn-fade', 'Fade'],
  ['popcorn-fade-in', 'Fade In'],
  ['popcorn-fade-in-up', 'Fade In Up'],
  ['popcorn-slide-up', 'Slide Up'],
  ['popcorn-slide-down', 'Slide Down'],
  ['popcorn-swivel-y', 'Swivel In (Y-axis)'],
  ['popcorn-swivel-x', 'Swivel In (X-axis)'],
  ['popcorn-typing-form', 'Typing Effect'],
  ['popcorn-blur-w', 'Blur (White)'],
  ['popcorn-wobble-vertical', 'Wobble Vertical'],
  ['popcorn-wobble-horizontal', 'Wobble Horizontal'],
  ['popcorn-wobble-diagonal', 'Wobble Diagonal'],
  ['popcorn-pulse', 'Pulse (Looped)'],
  ['popcorn-push', 'Push'],
  ['popcorn-bob', 'Bob'],
  ['popcorn-buzz', 'Buzz'],
  ['popcorn-buzz-out', 'Buzz out'],
  ['popcorn-stroke-pulse', 'Stroke Pulse (Looped)'],
  ['animate-flicker', 'Flicker'],
];

// Upstream form fonts list (subset of the Google Fonts it offered).
export const FORM_FONTS = ['Raleway', 'Anton', 'Bevan', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Oswald', 'Poppins', 'Playfair Display']
  .map((f) => [f, f]);

/** Upstream token: label upper-cased (used as the submitted field name). */
export function fieldToken(label) {
  return String(label || '').trim().toUpperCase() || 'FIELD';
}

const DISCLAIMER = 'By opting in you are giving us permission to reach out to you concerning this service. We will not share your information or spam.';

/** Pointer (arrow + bubble) defaults: upstream's red arrow and dark bubble. */
export const POINTER_DEFAULTS = {
  pointerEnabled: true,
  pointerStyle: 'curly',
  pointerColor: '#eb5054',
  pointerSize: 100,
  pointerMotion: 'nudge', // see POINTER_MOTIONS / TARGET_MOTIONS
  hintStyle: 'card', // see HINT_STYLES
  hintDim: 80, // % the form is dimmed while the pointer shows (upstream .8)
  hintBackground: '#17171c',
  hintBorderColor: '#575773',
  hintTextColor: '#ffffff',
  hintRadius: 12,
  hintPosition: 'bottom-right',
  hintDuration: 5, // seconds; 0 = stays until clicked
};

export function defaultOptin(kind = 'list-builder') {
  const personalizer = kind === 'personalizer';
  const lead = kind === 'lead-generator';
  const required = !lead; // a registration wall: every field must be filled
  return {
    enabled: false,
    kind,
    isPersonalizer: personalizer,
    // Manifest defaults (popcorn.retarget.js) + retarget-settings DEFAULT_OPTIONS.
    brandLogoSrc: '',
    enableSkipButton: false,
    caption: lead ? 'Please enter your details to find out more' : 'WANT TO PERSONALIZE YOUR VIDEO EXPERIENCE ',
    elements: personalizer
      ? [
          { id: 0, label: 'Email', token: 'EMAIL', type: 'email', required },
          { id: 2, label: 'First Name', token: 'FIRST NAME', type: 'singleline', required },
          { id: 3, label: 'Last name', token: 'LAST NAME', type: 'singleline', required },
        ]
      : [{ id: 0, label: 'Email', token: 'EMAIL', type: 'email', required }],
    privacyDisclaimer: personalizer ? '' : DISCLAIMER,
    privacyPolicyCaption: '',
    privacyPolicyLink: '',
    width: 100,
    height: 100,
    fontFamily: 'Raleway',
    captionFontSize: personalizer ? 75 : 76,
    captionAlignment: 'center',
    fontSize: personalizer ? 68 : 60,
    fontColor: '#ffffff',
    innerWidth: personalizer ? 90 : 65,
    innerHeight: 100,
    innerColor: '#ffffff',
    innerOpacity: 0,
    popupHeaderText: 'Create your very own personalized video',
    popupFillOutText: 'Fill out your',
    popupClickText: 'Click',
    popupDescriptionText: 'Experience the magic of the personalization',
    backgroundImage: '',
    backgroundColor: personalizer ? '#272735' : '#000000',
    // Backdrop behind the form. A registration wall hides the video entirely
    // (100); a Lead Generator mid-video dims it like upstream (67).
    backdropColor: '#3e3e51',
    backdropOpacity: lead ? 67 : 100,
    // Input styling (upstream hard-coded these: white, black text, 5px).
    inputBackground: '#ffffff',
    inputFontColor: '#000000',
    inputBorderColor: '#c1c1c1',
    inputBorderRadius: 5,
    // Play / submit button.
    btnText: 'Play',
    skipText: 'Skip',
    successMessage: 'Thanks!',
    // text styling
    captionColor: '', // '' = the form font colour
    captionBold: true,
    placeholderColor: '#6b7280',
    buttonFontSize: 100, // % of the form text size
    buttonFontWeight: '',
    // layout of the boxes + Play (one centred block)
    fieldLayout: 'auto',
    fieldWidth: 70,
    fieldGap: 6,
    fieldAlign: 'center',
    buttonWidth: 'full',
    buttonBackground: '#eb5054',
    buttonFontColor: '#ffffff',
    buttonHoverColor: '#d23f43',
    buttonBorderRadius: 5,
    btnBottomBorder: '#eb5054',
    webhookEnabled: false,
    webhook: '',
    webhook2: '',
    webhook3: '',
    emailEnabled: false,
    emailAddress: '',
    emailAddress2: '',
    emailAddress3: '',
    fbPixelId: '',
    espProvider: '',
    espListId: '',
    transition: 'popcorn-none',
    ...POINTER_DEFAULTS,
    pointerEnabled: !lead, // upstream only showed the arrow on the List Builder
    // List Builder only: skip the form for viewers who already filled it in.
    askEveryVisit: false,
  };
}

export function defaultListBuilder(kind = 'list-builder') {
  return defaultOptin(kind);
}

/** Fill any option a saved List Builder predates (new design / pointer options). */
export function normalizeListBuilder(config) {
  if (!config) return config;
  const kind = config.kind === 'personalizer' ? 'personalizer' : 'list-builder';
  return { ...defaultOptin(kind), ...config, kind, isPersonalizer: kind === 'personalizer' };
}

const pointerThumb = (design, options) => {
  const color = options.pointerColor || '#eb5054';
  if (design.mode === 'target') {
    const ring = `<circle cx="12" cy="12" r="9" fill="none" stroke="${color}" stroke-width="1.6" opacity=".8"/>`;
    return `<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">${ring}${pointerSvg(design.id, color)}</svg>`;
  }
  return `<svg viewBox="0 0 129 72" width="64" height="36" aria-hidden="true">${pointerSvg(design.id, color) || '<text x="64" y="42" text-anchor="middle" fill="currentColor" font-size="22">none</text>'}</svg>`;
};

const STYLE_FIELDS = [
  { key: 'enabled', label: 'Require viewers to fill this out before the video plays', type: 'toggle', showIf: (o) => o.kind !== 'lead-generator' },
  { key: 'kind', label: 'Form type', type: 'select', options: Object.entries(LIST_BUILDER_KINDS), showIf: (o) => o.kind !== 'lead-generator' },
  { key: 'brandLogoSrc', label: 'Brand Logo URL', type: 'url' },
  { key: 'enableSkipButton', label: 'Enable Skip Button (lets viewers bypass the form)', type: 'toggle' },
  { key: 'captionFontSize', label: 'Caption Font Size', type: 'range', min: 10, max: 200 },
  { key: 'captionAlignment', label: 'Caption Alignment', type: 'select', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] },
  { key: 'captionColor', label: 'Caption color (empty = form font color)', type: 'color' },
  { key: 'captionBold', label: 'Caption in bold', type: 'toggle' },
  { key: 'fontFamily', label: 'Font', type: 'select', options: FORM_FONTS },
  { key: 'fontSize', label: 'Font Size', type: 'range', min: 10, max: 200 },
  { key: 'fontColor', label: 'Font color', type: 'color' },
  { key: 'width', label: 'Width', type: 'range', min: 10, max: 100 },
  { key: 'height', label: 'Height', type: 'range', min: 10, max: 100 },
  { key: 'innerWidth', label: 'Inner Width', type: 'range', min: 10, max: 100 },
  { key: 'innerHeight', label: 'Inner Height', type: 'range', min: 10, max: 100 },
  { key: 'innerColor', label: 'Inner Color', type: 'color' },
  { key: 'innerOpacity', label: 'Inner Opacity', type: 'range', min: 0, max: 100 },
  { key: 'backgroundImage', label: 'Background Image URL', type: 'url' },
  { key: 'backgroundColor', label: 'Background color', type: 'color' },
  { key: 'backdropColor', label: 'Backdrop color (behind the form)', type: 'color' },
  { key: 'backdropOpacity', label: 'Backdrop opacity (100 hides the video)', type: 'range', min: 0, max: 100 },
  { key: 'inputBackground', label: 'Input Background color', type: 'color' },
  { key: 'inputFontColor', label: 'Input Text color', type: 'color' },
  { key: 'inputBorderColor', label: 'Input Border color', type: 'color' },
  { key: 'inputBorderRadius', label: 'Input border radius', type: 'range', min: 0, max: 30 },
  { key: 'placeholderColor', label: 'Box hint text color', type: 'color' },
  { key: 'buttonBackground', label: 'Play Button Background color', type: 'color' },
  { key: 'buttonFontColor', label: 'Play Button Font color', type: 'color' },
  { key: 'buttonFontSize', label: 'Play Button text size (% of form text)', type: 'range', min: 50, max: 250 },
  { key: 'buttonFontWeight', label: 'Play Button text weight', type: 'select', options: [['', 'Default'], ['400', 'Regular'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold']] },
  { key: 'buttonHoverColor', label: 'Play Button Hover color', type: 'color' },
  { key: 'buttonBorderRadius', label: 'Button border radius', type: 'range', min: 0, max: 50 },
  { key: 'btnBottomBorder', label: 'Button Bottom Border color', type: 'color' },
  { key: 'transition', label: 'Transition', type: 'select', options: FORM_TRANSITIONS },
];

// All the copy on the form, in one place (the first tab).
const TEXT_FIELDS = (personalizer) => [
  { key: 'caption', label: 'Caption (the title above the boxes)', type: 'textarea', rows: 3 },
  { key: 'btnText', label: 'Play button text', type: 'text' },
  { key: 'skipText', label: 'Skip button text', type: 'text', showIf: (o) => o.enableSkipButton },
  { key: 'successMessage', label: 'Message after the form is sent', type: 'text' },
  { key: 'privacyDisclaimer', label: 'Privacy text', type: 'textarea', showIf: () => !personalizer },
  { key: 'privacyPolicyCaption', label: 'Privacy policy link text', type: 'text' },
  { key: 'privacyPolicyLink', label: 'Privacy policy link (URL)', type: 'url' },
  { key: 'popupHeaderText', label: 'Pointer bubble: title', type: 'text', showIf: (o) => o.pointerEnabled },
  { key: 'popupFillOutText', label: 'Pointer bubble: "Fill out your" line', type: 'text', showIf: (o) => o.pointerEnabled },
  { key: 'popupClickText', label: 'Pointer bubble: "Click" line', type: 'text', showIf: (o) => o.pointerEnabled },
  { key: 'popupDescriptionText', label: 'Pointer bubble: description', type: 'text', showIf: (o) => o.pointerEnabled },
];

const LAYOUT_FIELDS = [
  { key: 'fieldLayout', label: 'Box layout', type: 'select', options: FIELD_LAYOUTS },
  { key: 'fieldWidth', label: 'Boxes width (% of the form)', type: 'range', min: 30, max: 100 },
  { key: 'fieldGap', label: 'Space between boxes', type: 'range', min: 0, max: 20 },
  { key: 'fieldAlign', label: 'Align boxes', type: 'select', options: [['center', 'Center'], ['left', 'Left']] },
  { key: 'buttonWidth', label: 'Play button width', type: 'select', options: [['full', 'Same width as the boxes'], ['auto', 'Fit the text']] },
];

const POINTER_FIELDS = [
  { key: 'pointerEnabled', label: 'Show the pointer (arrow + bubble) when the form appears', type: 'toggle' },
  { key: 'pointerStyle', label: 'Pointer design', type: 'designPicker', designs: POINTER_DESIGNS, categories: POINTER_CATEGORIES, thumb: pointerThumb, showIf: (o) => o.pointerEnabled },
  { key: 'pointerMotion', label: 'Animation', type: 'select', optionsFor: (o) => (isTargetDesign(o.pointerStyle) ? TARGET_MOTIONS : POINTER_MOTIONS), showIf: (o) => o.pointerEnabled },
  { key: 'pointerTheme', label: 'Color scheme', type: 'themePicker', themes: POINTER_THEMES, showIf: (o) => o.pointerEnabled },
  { key: 'pointerColor', label: 'Pointer color', type: 'color', showIf: (o) => o.pointerEnabled },
  { key: 'pointerSize', label: 'Pointer size', type: 'range', min: 40, max: 200, showIf: (o) => o.pointerEnabled },
  { key: 'hintStyle', label: 'Bubble style', type: 'select', options: HINT_STYLES, showIf: (o) => o.pointerEnabled },
  { key: 'hintDim', label: 'Dim the form while it shows', type: 'range', min: 0, max: 100, showIf: (o) => o.pointerEnabled },
  { key: 'hintBackground', label: 'Bubble Background color', type: 'color', showIf: (o) => o.pointerEnabled },
  { key: 'hintBorderColor', label: 'Bubble Border color', type: 'color', showIf: (o) => o.pointerEnabled },
  { key: 'hintTextColor', label: 'Bubble Text color', type: 'color', showIf: (o) => o.pointerEnabled },
  { key: 'hintRadius', label: 'Bubble corner radius', type: 'range', min: 0, max: 40, showIf: (o) => o.pointerEnabled },
  { key: 'hintPosition', label: 'Bubble position', type: 'select', options: HINT_POSITIONS, showIf: (o) => o.pointerEnabled },
  { key: 'hintDuration', label: 'Show for (seconds, 0 = until clicked)', type: 'range', min: 0, max: 30, showIf: (o) => o.pointerEnabled },
];

/** Schema for ./addonEditor.js, grouped into upstream's tabs (+ Pointer). */
export function listBuilderFields(config) {
  const personalizer = config?.kind === 'personalizer';
  const lead = config?.kind === 'lead-generator';
  const fields = [
    ...TEXT_FIELDS(personalizer).map((f) => ({ ...f, tab: 'Text' })),
    ...STYLE_FIELDS.map((f) => ({ ...f, tab: 'Styles' })),
    { key: 'elements', label: lead ? 'Form boxes (1–5)' : 'Form boxes (1–5, required)', type: 'fieldList', min: 1, max: 5, placeholders: true, fieldTypes: lead ? LEAD_FIELD_TYPES : FORM_FIELD_TYPES, tab: 'Fields' },
    ...LAYOUT_FIELDS.map((f) => ({ ...f, tab: 'Fields' })),
    ...POINTER_FIELDS.map((f) => ({ ...f, tab: 'Pointer', ...(f.optionsFor ? { options: f.optionsFor(config || {}) } : {}) })),
  ];
  if (!lead) fields.push({ key: 'askEveryVisit', label: 'Ask returning viewers every visit', type: 'toggle', tab: 'Fields' });
  if (!personalizer) {
    fields.push(
      { key: 'webhookEnabled', label: 'Webhook Call', type: 'toggle', tab: 'Integrations' },
      { key: 'webhook', label: 'Webhook Address', type: 'url', tab: 'Integrations', showIf: (o) => o.webhookEnabled },
      { key: 'webhook2', label: 'Webhook Address 2', type: 'url', tab: 'Integrations', showIf: (o) => o.webhookEnabled },
      { key: 'webhook3', label: 'Webhook Address 3', type: 'url', tab: 'Integrations', showIf: (o) => o.webhookEnabled },
      { key: '_webhookTest', label: 'Test Webhook', type: 'action', action: 'testWebhooks', tab: 'Integrations', showIf: (o) => o.webhookEnabled },
      { key: '_webhookLog', label: 'Recent webhook deliveries', type: 'action', action: 'webhookLog', tab: 'Integrations', showIf: (o) => o.webhookEnabled },
      { key: '_webhookSecret', label: 'Show webhook signing secret', type: 'action', action: 'signingSecret', tab: 'Integrations', showIf: (o) => o.webhookEnabled },
      { key: 'emailEnabled', label: 'Email Notification', type: 'toggle', tab: 'Integrations' },
      { key: 'emailAddress', label: 'Notification Address (person 1)', type: 'text', tab: 'Integrations', showIf: (o) => o.emailEnabled },
      { key: 'emailAddress2', label: 'Notification Address (person 2, optional)', type: 'text', tab: 'Integrations', showIf: (o) => o.emailEnabled },
      { key: 'emailAddress3', label: 'Notification Address (person 3, optional)', type: 'text', tab: 'Integrations', showIf: (o) => o.emailEnabled },
      { key: 'fbPixelId', label: 'Facebook Pixel ID', type: 'text', tab: 'Integrations' },
      { key: 'espProvider', label: 'Add leads to an email list (published videos)', type: 'select', options: ESP_PROVIDERS, tab: 'Integrations' },
      { key: 'espListId', label: espListLabel(config?.espProvider), type: 'text', tab: 'Integrations', showIf: (o) => !!o.espProvider },
      { key: '_espConnect', label: `Connect ${espName(config?.espProvider) || 'account'}`, type: 'action', action: 'connectEsp', tab: 'Integrations', showIf: (o) => !!o.espProvider },
    );
  }
  return fields;
}

/** Webhook URLs in the shape leadClient.webhookUrlsFor expects. */
export function listBuilderWebhookConfig(config) {
  return {
    webhookEnabled: !!config?.webhookEnabled,
    webhookUrl: config?.webhook,
    webhookUrl2: typeof config?.webhook2 === 'object' ? config.webhook2?.value : config?.webhook2,
    webhookUrl3: typeof config?.webhook3 === 'object' ? config.webhook3?.value : config?.webhook3,
  };
}

/**
 * Switching kind swaps in that kind's upstream defaults (Personalizer has its
 * own field set and colours), keeping the enabled flag.
 */
export function switchListBuilderKind(config, kind) {
  return { ...defaultListBuilder(kind), enabled: !!config?.enabled };
}

// ------------------------------------------------- Lead Generator clip adapter

// opt-in option → Lead Generator clip key (top level of the clip).
const CLIP_KEYS = {
  caption: 'heading',
  btnText: 'ctaText',
  privacyDisclaimer: 'privacyText',
  privacyPolicyCaption: 'privacyPolicyCaption',
  privacyPolicyLink: 'privacyPolicyLink',
  brandLogoSrc: 'brandLogoUrl',
  enableSkipButton: 'skipButtonEnabled',
  webhookEnabled: 'webhookEnabled',
  webhook: 'webhookUrl',
  webhook2: 'webhookUrl2',
  webhook3: 'webhookUrl3',
  emailEnabled: 'emailNotificationEnabled',
  emailAddress: 'notificationEmail',
  emailAddress2: 'notificationEmail2',
  emailAddress3: 'notificationEmail3',
  fbPixelId: 'fbPixelId',
  espProvider: 'espProvider',
  espListId: 'espListId',
};

// opt-in option → clip.style key.
const STYLE_KEYS = {
  fontFamily: 'fontFamily',
  buttonBackground: 'buttonColor',
  buttonFontColor: 'buttonFontColor',
  buttonBorderRadius: 'buttonBorderRadius',
  btnBottomBorder: 'buttonBottomBorder',
  captionAlignment: 'captionAlignment',
  transition: 'transition',
  backgroundColor: 'backgroundColor',
  backgroundImage: 'backgroundImage',
  fontSize: 'fontSize',
  captionFontSize: 'captionFontSize',
  width: 'widthPercent',
  height: 'heightPercent',
  // upstream popcorn.form.js options (added to the Lead Generator clip's style)
  fontColor: 'fontColor',
  innerWidth: 'innerWidth',
  innerHeight: 'innerHeight',
  innerColor: 'innerColor',
  innerOpacity: 'innerOpacity',
};

const OWN_KEYS = new Set(['enabled', 'kind', 'isPersonalizer', 'elements']);

const toOptinTransition = (t) => (!t || t === 'none' ? 'popcorn-none' : /^(popcorn-|animate-)/.test(t) ? t : `popcorn-${t}`);

/** Lead Generator clip → shared opt-in config (what the renderer + editor use). */
export function leadFormToOptin(clip) {
  const base = defaultOptin('lead-generator');
  const style = clip?.style || {};
  const out = { ...base };
  for (const [opt, key] of Object.entries(CLIP_KEYS)) {
    if (clip?.[key] !== undefined) out[opt] = clip[key];
  }
  for (const [opt, key] of Object.entries(STYLE_KEYS)) {
    if (style[key] !== undefined && style[key] !== '') out[opt] = style[key];
  }
  out.transition = toOptinTransition(out.transition);
  // A legacy clip saved a 'none' bottom border as ''/undefined: keep the default look.
  const fields = Array.isArray(clip?.fields) && clip.fields.length ? clip.fields : [{ id: 'email', type: 'email', label: 'Email' }];
  const tokens = leadFieldTokens(fields);
  out.elements = fields.slice(0, 5).map((f, i) => ({
    id: f.id ?? i,
    label: f.label ?? '',
    type: f.type === 'text' || !f.type ? 'singleline' : f.type,
    token: tokens[i],
    required: !!f.required,
    placeholder: f.placeholder || '',
  }));
  Object.assign(out, clip?.design || {});
  out.kind = 'lead-generator';
  out.isPersonalizer = false;
  out.enabled = true;
  return out;
}

const slug = (label) => String(label || 'field').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'field';

/** Write an edited opt-in config back onto the Lead Generator clip (mutates). */
export function applyOptinToLeadForm(clip, next) {
  clip.style = clip.style || {};
  clip.design = clip.design || {};
  for (const [key, value] of Object.entries(next)) {
    if (OWN_KEYS.has(key)) continue;
    if (CLIP_KEYS[key]) clip[CLIP_KEYS[key]] = value;
    else if (STYLE_KEYS[key]) clip.style[STYLE_KEYS[key]] = value;
    else clip.design[key] = value;
  }
  const used = new Set();
  clip.fields = (next.elements || []).slice(0, 5).map((e, i) => {
    let id = (typeof e.id === 'string' && e.id) ? e.id : slug(e.label);
    if (used.has(id)) id = `${id}_${i + 1}`;
    used.add(id);
    return { id, type: e.type === 'singleline' ? 'text' : e.type, label: e.label, required: !!e.required, ...(e.placeholder ? { placeholder: e.placeholder } : {}) };
  });
  if (!clip.fields.length) clip.fields = [{ id: 'email', type: 'email', label: 'Email' }];
  return clip;
}

const TOKEN_TO_PROFILE = { EMAIL: 'email', 'FIRST NAME': 'firstName', 'LAST NAME': 'lastName', COMPANY: 'company' };

/**
 * Personalizer: store answers as the active personalization profile, using
 * the same localStorage keys PersonalizeModal and the timeline's
 * getActivePersonalizationProfile read.
 */
export function savePersonalizerProfile(data, storage = globalThis.localStorage) {
  if (!storage) return null;
  const variables = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined || v === '') continue;
    variables[TOKEN_TO_PROFILE[String(k).toUpperCase()] || k] = String(v);
  }
  if (variables.firstName || variables.lastName) {
    variables.fullName = [variables.firstName, variables.lastName].filter(Boolean).join(' ');
  }
  const profile = {
    id: `viewer-${Date.now()}`,
    name: variables.fullName || variables.email || 'Viewer',
    source: 'personalizer',
    variables,
  };
  try {
    const profiles = JSON.parse(storage.getItem('remix_contact_profiles') || '[]');
    profiles.push(profile);
    storage.setItem('remix_contact_profiles', JSON.stringify(profiles));
    storage.setItem('remix_selected_contact_id', profile.id);
  } catch {
    return null;
  }
  return profile;
}
