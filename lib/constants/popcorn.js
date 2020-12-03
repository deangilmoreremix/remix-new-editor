import blendModeConstants from './blendMode';

export const SEQUENCER = 'sequencer';

export const MEDIA_TYPES = {
  IMAGE: 'image',
  VIDEO: SEQUENCER,
  AUDIO: SEQUENCER,
  LOTTIE_JSON: 'lottie-json',
};

export const SOCIAL_TYPES = {
  FB_LIKE: 'fb-like',
  FB_COMMENTS: 'fb-comments',
  FB_PAGE: 'fb-page',
  FB_COMMENTS_EMBED: 'fb-comment-embed',
  FB_POST: 'fb-post',
};

export const POPCORN_ELEMENT_TYPES = {
  TEXT: 'text',
  PAUSE: 'pausePlugin',
  JSON_ANIMATION: 'json-animation',
  JSON_TRANSITION: 'json-transition',
  IMAGE: 'image',
  PERSONALIZED_IMAGE: 'personalizedImage',
  VIDEO_TRANSITION: 'video-transition',
  RETARGET: 'retargetForm',
  ADVANCED_OPTIN: 'advancedRetargetForm',
  LOTTIE_JSON: 'lottie-json',
  SEQUENCER,
  JSON_BUTTON: 'json-button',
  LEAD_GENERATOR: 'form',
  SOCIAL: 'social',
  LOOP: 'loopPlugin',
  SKIP: 'skip',
  GOOGLE_MAP: 'googlemap',
  TEXT_MASK: 'seethroughtext',
  BACKGROUND: 'background',
  BLEND_MODE: 'blendMode',
};

export const POPCORN_ELEMENT_LABELS = {
  [POPCORN_ELEMENT_TYPES.TEXT]: 'Smart Text',
  [POPCORN_ELEMENT_TYPES.PAUSE]: 'Pause',
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: 'Lower Third',
  [POPCORN_ELEMENT_TYPES.JSON_TRANSITION]: 'Overlay',
  [POPCORN_ELEMENT_TYPES.IMAGE]: 'Image',
  [POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE]: 'Personalized Image',
  [POPCORN_ELEMENT_TYPES.JSON_BUTTON]: 'CTA',
  [POPCORN_ELEMENT_TYPES.SKIP]: 'Skip',
  [MEDIA_TYPES.LOTTIE_JSON]: 'Sticker',
  [POPCORN_ELEMENT_TYPES.SOCIAL]: 'Social',
  [POPCORN_ELEMENT_TYPES.LOOP]: 'Loop',
  [POPCORN_ELEMENT_TYPES.LEAD_GENERATOR]: 'form',
  [POPCORN_ELEMENT_TYPES.GOOGLE_MAP]: 'Google map',
  [POPCORN_ELEMENT_TYPES.BACKGROUND]: 'Background',
  [POPCORN_ELEMENT_TYPES.TEXT_MASK]: 'Text Mask',
};

export const MIN_DURATION = 1;
export const ON = 'on';
export const OFF = 'off';

// Manifest field names
export const URL = 'url';
export const HREF = 'href';
export const DROP_BUTTON = 'dropButton';
export const LEFT = 'left';
export const TOP = 'top';
export const WIDTH = 'width';
export const HEIGHT = 'height';
export const EDITOR_WIDTH = 'editorWidth';
export const EDITOR_HEIGHT = 'editorHeight';
export const ZINDEX = 'zindex';
export const SCRIPTS = 'scripts';
export const ANIMATION = 'animation';
export const OUT_DURATION = 'outDuration';
export const DEFAULT_FONT = 'Anton';
export const FIELD_TEXT = 'text';
export const HTML_FIELD_TEXT = 'htmlText';
export const HTML_LINK_URL = 'htmlUrl';
export const FONT_DECORATIONS = 'fontDecorations';
export const LINK_URL = 'linkUrl';
export const CALL_NOTIFY_ADDRESS = 'callNotifyAddress';
export const LINKTARGET = 'linkTarget';
export const POSITION = 'position';
export const ALIGNMENT = 'alignment';
export const START = 'start';
export const END = 'end';
export const TRANSITION = 'transition';
export const ROTATION = 'rotation';
export const FONT_FAMILY = 'fontFamily';
export const FONT_SIZE = 'fontSize';
export const DURATION = 'duration';
export const FONT_COLOR = 'fontColor';
export const SHADOW = 'shadow';
export const SHADOW_COLOR = 'shadowColor';
export const BACKGROUND = 'background';
export const BACKGROUND_COLOR = 'backgroundColor';
export const STROKE = 'stroke';
export const STROKE_COLOR = 'strokeColor';
export const BOLD = 'bold';
export const ITALICS = 'italics';
export const RESPONSIVE = 'responsive';
export const LINKSRC = 'linkSrc';
export const TITLE = 'title';
export const CORNER_RADIUS = 'cornerRadius';
export const BLEND_MODE = 'blendMode';
export const SRC = 'src';
export const HTML_SRC = 'htmlSrc';
export const INNER_TOP = 'innerTop';
export const INNER_LEFT = 'innerLeft';
export const INNER_WIDTH = 'innerWidth';
export const INNER_HEIGHT = 'innerHeight';
export const KIND = 'kind';
export const FROM = 'from';
export const TO = 'to';
export const FROM_URL = 'fromUrl';
export const TO_URL = 'toUrl';
export const TARGET = 'target';
export const BRAND_LOGO_SRC = 'brandLogoSrc';
export const SKIP_BUTTON = 'enableSkipButton';
export const CAPTION = 'caption';
export const ELEMENTS = 'elements';
export const PRIVACY_DISCLAIMER = 'privacyDisclaimer';
export const PRIVACY_POLICY_CAPTION = 'privacyPolicyCaption';
export const PRIVACY_POLICY_LINK = 'privacyPolicyLink';
export const CAPTION_SIZE = 'captionFontSize';
export const CAPTION_ALIGNMENT = 'captionAlignment';
export const INNER_COLOR = 'innerColor';
export const INNER_OPACITY = 'innerOpacity';
export const BACKGROUND_IMAGE = 'backgroundImage';
export const BTN_TEXT = 'btnText';
export const BTN_BACKGROUND = 'buttonBackground';
export const BTN_FONT_COLOR = 'buttonFontColor';
export const BTN_BORDER_RADIUS = 'buttonBorderRadius';
export const BTN_BOTTOM_BORDER = 'btnBottomBorder';
export const WEBHOOK_ENABLED = 'webhookEnabled';
export const WEBHOOK = 'webhook';
export const DIAL_ENABLED = 'dialEnabled';
export const PHONE = 'phone';
export const VERIFY_WEBHOOK = 'verifyWebhook';
export const EMAIL_ENABLED = 'emailEnabled';
export const EMAIL_ADDRESS = 'emailAddress';
export const VOLUME = 'volume';
export const MUTE = 'mute';
export const HIDDEN = 'hidden';
export const AUDIO_FADE_IN = 'audioFadeIn';
export const AUDIO_FADE_OUT = 'audioFadeOut';
export const OPACITY = 'opacity';
export const LOOP = 'loop';
export const ZOOM = 'zoom';
export const TYPE = 'type';
export const FULLSCREEN = 'fullscreen';
export const LOCATION = 'location';
export const HEADING = 'heading';
export const PITCH = 'pitch';
export const FILL = 'fill';
export const STYLES_FIELD = 'styles';
export const PAUSED = 'paused';
export const RUNNING = 'running';

// TABS & GROUPS
export const BASIC = 'BASIC';
export const ADVANCED = 'ADVANCED';
export const SCRIPT = 'SCRIPT';
export const ADVANCED_GROUP = 'advanced';
export const BASIC_GROUP = 'basic';
export const TRANSITION_TAB = 'Transition';
export const STYLES = 'STYLES';
export const FIELDS = 'FIELDS';
export const INTEGRATIONS = 'INTEGRATIONS';
export const CLIP_EDITOR_TAB = 'CLIP EDITOR';
export const JSON_BUTTON_TAB = 'CTA';

// labels and others
export const LABEL_CLICK_TO_PHONE = 'URL (Click-to-action) or Phone Number (Click-to-call)';

export const CARET_NAMES = {
  CARET_OFFSET: 'caretOffset',
  URL_CARET_OFFSET: 'urlCaretOffset',
};

export const MANIFEST_OPTIONS = {
  [BLEND_MODE]: {
    default: blendModeConstants.normal.value,
    hidden: true,
  },
  [OPACITY]: {
    default: 100,
    hidden: true,
  },
  [URL]: {
    type: 'input',
    label: 'URL (Click-to-action)',
    group: 'basic',
    default: '',
  },
  [LEFT]: {
    type: 'number',
    label: 'Left',
    default: 0,
    hidden: true,
  },
  [TOP]: {
    type: 'number',
    label: 'Top',
    default: 0,
    hidden: true,
  },
  [WIDTH]: {
    type: 'number',
    label: 'Width',
    default: 100,
    hidden: true,
  },
  [HEIGHT]: {
    type: 'number',
    label: 'Height',
    default: 100,
    hidden: true,
  },
  [ZINDEX]: {
    default: 1000,
    hidden: true,
  },
};
