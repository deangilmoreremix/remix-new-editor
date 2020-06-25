import { POPCORN_ELEMENT_TYPES } from '../popcorn';

export const BASIC = 'BASIC';

export const INITIAL_VALUES = {
  type: POPCORN_ELEMENT_TYPES.IMAGE,
  src: '',
};

export const TABS = [
  { label: BASIC },
];

export const CROP_RECOMMENDED_RESOLUTION = {
  width: 1200,
  height: 630,
};

export const TUI_EDITOR_RECOMMENDED_RESOLUTION = {
  width: 700,
  height: 500,
};

export const CROP_BRAND_LOGO_RESOLUTION = {
  width: 300,
  height: 100,
};

export const IMAGE_CANT_BE_UPLOADED_ERROR = 'This image can\'t be uploaded.';
export const IMAGE_NOT_FOUND_ERROR = 'Image not found';
export const IMAGE_NOT_SUPPORTED_ERROR = 'This image format is not supported.';
