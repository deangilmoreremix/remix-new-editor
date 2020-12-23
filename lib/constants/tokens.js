import { HTML_FIELD_TEXT, HTML_LINK_URL } from './popcorn';

export const CUSTOM = 'custom';

export const TOKEN_WINDOW_TITLE = 'Personalized Token';

export const TOKEN_FORMATS = {
  SVG: 'svg',
};

export const tokens = [
  'firstname',
  'lastname',
  'email',
  'geocountry',
  'geocity',
  'geostate',
  'name',
  // 'gender',
  CUSTOM,
];

export const imgTokens = ['image'];

export const INPUT_PLACEHOLDER = 'Enter Default Value';

export const tokenModes = {
  plain: 'Plain',
  fallbackValue: 'Fallback value',
  uppercase: 'UPPERCASE',
};

export const imgTokenModes = {
  plain: 'Plain',
  fallbackValue: 'Fallback value',
};

export const TOKEN_HELPER_CLASSES = {
  d: 'token-default',
  default: 'token-default',
  up: 'token-uppercase',
  uppercase: 'token-uppercase',
};
export const OPEN_PERSONALIZATION_TAG = '<span class="personalized-token" contenteditable="false">';
export const CLOSE_PERSONALIZATION_TAG = '</span>';
export const OPEN_PERSONALIZATION_TAG_SVG = '<tspan class="personalized-token-svg" contenteditable="false">';
export const CLOSE_PERSONALIZATION_TAG_SVG = '</tspan>';


export const CARET_FIELDS = {
  [HTML_LINK_URL]: 'urlCaretOffset',
  [HTML_FIELD_TEXT]: 'caretOffset',
};

export const TOKEN_REGEX = /{{(up \w*|d \w* ("[^{}]*"|'[^{}]*')|"\w*"|\w*)}}/gm;
