/**
 * List Builder / Personalizer — one project-level opt-in form.
 *
 * Re-implemented from upstream strategic-limited/remix-new-editor:
 *   lib/popcorn/plugins/retarget/popcorn.retarget.js (Popcorn.compose('retargetForm'))
 *   lib/constants/settings/retarget-settings.js  (DEFAULT_OPTIONS, DEFAULT_OPTIONS_OPTIN,
 *                                                  ARRAY_ELEMENTS_RETARGET, ARRAY_TRANSITIONS)
 *   lib/constants/settings/advanced-optin.js      (Personalizer = isPersonalizer: true)
 *   components/settings/lead-generator/*          (Styles / Fields / Integrations tabs)
 *
 * Same option names and defaults as the upstream manifest so the form looks
 * and behaves the same: full-frame form, radial-gradient background, Raleway
 * font, #eb5054 "Play" button, 1–5 fields with the per-count layout, optional
 * Skip button, and the red-arrow "Fill out your … / Click Play" hint popup.
 * Upstream stored it on the project as `retargetForm`; here it is
 * `state.listBuilder`. It shows at the start of the video and holds playback
 * until the viewer submits (or skips).
 *
 * Personalizer: no Integrations tab, no privacy disclaimer; answers are
 * written into the personalization profile store so {{first_name}} tokens in
 * the rest of the video resolve to them.
 */

export const LIST_BUILDER_KINDS = {
  'list-builder': 'List Builder',
  personalizer: 'Personalizer',
};

// Upstream ARRAY_ELEMENTS_RETARGET
export const FORM_FIELD_TYPES = [
  ['singleline', 'Singleline'],
  ['multiline', 'Multiline'],
  ['email', 'Email'],
  ['number', 'Number'],
  ['date', 'Date'],
];

// Upstream ARRAY_TRANSITIONS
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
  ['popcorn-blur-w', 'Blur (White)'],
  ['popcorn-wobble-vertical', 'Wobble Vertical'],
  ['popcorn-wobble-horizontal', 'Wobble Horizontal'],
  ['popcorn-pulse', 'Pulse (Looped)'],
  ['popcorn-bob', 'Bob'],
  ['popcorn-buzz', 'Buzz'],
];

// Upstream form fonts list (subset of the Google Fonts it offered).
export const FORM_FONTS = ['Raleway', 'Anton', 'Bevan', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Oswald', 'Poppins', 'Playfair Display']
  .map((f) => [f, f]);

/** Upstream token: label upper-cased (used as the submitted field name). */
export function fieldToken(label) {
  return String(label || '').trim().toUpperCase() || 'FIELD';
}

export function defaultListBuilder(kind = 'list-builder') {
  const personalizer = kind === 'personalizer';
  return {
    enabled: false,
    kind,
    isPersonalizer: personalizer,
    // Manifest defaults (popcorn.retarget.js) + retarget-settings DEFAULT_OPTIONS.
    brandLogoSrc: '',
    enableSkipButton: false,
    caption: 'WANT TO PERSONALIZE YOUR VIDEO EXPERIENCE ',
    elements: personalizer
      ? [
          { id: 0, label: 'Email', token: 'EMAIL', type: 'email' },
          { id: 2, label: 'First Name', token: 'FIRST NAME', type: 'singleline' },
          { id: 3, label: 'Last name', token: 'LAST NAME', type: 'singleline' },
        ]
      : [{ id: 0, label: 'Email', token: 'EMAIL', type: 'email' }],
    privacyDisclaimer: personalizer ? '' : 'By opting in you are giving us permission to reach out to you concerning this service. We will not share your information or spam.',
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
    btnText: 'Play',
    buttonBackground: '#eb5054',
    buttonFontColor: '#ffffff',
    buttonBorderRadius: 5,
    btnBottomBorder: '#eb5054',
    webhookEnabled: false,
    webhook: '',
    webhook2: '',
    webhook3: '',
    emailEnabled: false,
    emailAddress: '',
    fbPixelId: '',
    transition: 'popcorn-none',
  };
}

const STYLE_FIELDS = [
  { key: 'enabled', label: 'Show at the start of the video', type: 'toggle' },
  { key: 'kind', label: 'Form type', type: 'select', options: Object.entries(LIST_BUILDER_KINDS) },
  { key: 'brandLogoSrc', label: 'Brand Logo URL', type: 'url' },
  { key: 'enableSkipButton', label: 'Enable Skip Button', type: 'toggle' },
  { key: 'caption', label: 'Caption', type: 'textarea' },
  { key: 'captionFontSize', label: 'Caption Font Size', type: 'range', min: 10, max: 200 },
  { key: 'captionAlignment', label: 'Caption Alignment', type: 'select', options: [['left', 'Left'], ['center', 'Center'], ['right', 'Right']] },
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
  { key: 'btnText', label: 'Submit Button Label', type: 'text' },
  { key: 'buttonBackground', label: 'Button Background color', type: 'color' },
  { key: 'buttonFontColor', label: 'Button Font color', type: 'color' },
  { key: 'buttonBorderRadius', label: 'Button border radius', type: 'range', min: 0, max: 50 },
  { key: 'btnBottomBorder', label: 'Button Bottom Border color', type: 'color' },
  { key: 'transition', label: 'Transition', type: 'select', options: FORM_TRANSITIONS },
  { key: 'popupHeaderText', label: 'Pop-up Header Text', type: 'text' },
  { key: 'popupFillOutText', label: 'Pop-up Fill Out Text', type: 'text' },
  { key: 'popupClickText', label: 'Pop-up Click Text', type: 'text' },
  { key: 'popupDescriptionText', label: 'Pop-up Description Text', type: 'text' },
];

/** Schema for ./addonEditor.js, grouped into upstream's tabs. */
export function listBuilderFields(config) {
  const personalizer = config?.kind === 'personalizer';
  const fields = [
    ...STYLE_FIELDS.map((f) => ({ ...f, tab: 'Styles' })),
    { key: 'elements', label: 'Form fields (1–5)', type: 'fieldList', min: 1, max: 5, fieldTypes: FORM_FIELD_TYPES, tab: 'Fields' },
    { key: 'privacyDisclaimer', label: 'Privacy Disclaimer', type: 'textarea', tab: 'Fields', showIf: () => !personalizer },
    { key: 'privacyPolicyCaption', label: 'Privacy Policy Label', type: 'text', tab: 'Fields' },
    { key: 'privacyPolicyLink', label: 'Privacy Policy Link', type: 'url', tab: 'Fields' },
  ];
  if (!personalizer) {
    fields.push(
      { key: 'webhookEnabled', label: 'Webhook Call', type: 'toggle', tab: 'Integrations' },
      { key: 'webhook', label: 'Webhook Address', type: 'url', tab: 'Integrations', showIf: (o) => o.webhookEnabled },
      { key: 'webhook2', label: 'Webhook Address 2', type: 'url', tab: 'Integrations', showIf: (o) => o.webhookEnabled },
      { key: 'webhook3', label: 'Webhook Address 3', type: 'url', tab: 'Integrations', showIf: (o) => o.webhookEnabled },
      { key: 'emailEnabled', label: 'Email Notification', type: 'toggle', tab: 'Integrations' },
      { key: 'emailAddress', label: 'Notification Address', type: 'text', tab: 'Integrations', showIf: (o) => o.emailEnabled },
      { key: 'fbPixelId', label: 'Facebook Pixel ID', type: 'text', tab: 'Integrations' },
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
