import JsonAnimation from '../../../components/settings/json-animation/JsonAnimation';
import TextSettings from '../../../components/settings/text-settings/TextSettings';
import { ADVANCED, BASIC, INITIAL_VALUES as jsonAnimationValues, SCRIPT } from './json-animation';
import { POPCORN_ELEMENT_TYPES } from '../popcorn';
import { INITIAL_VALUES as vrtextValues } from './vrtext-element';

export const SETTINGS_COMPONENTS = {
  [POPCORN_ELEMENT_TYPES.TEXT]: TextSettings,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: JsonAnimation,
};

export const DEFAULT_SETTINGS = {
  [POPCORN_ELEMENT_TYPES.TEXT]: vrtextValues,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: jsonAnimationValues,
};

export const DEFAULT_TABS = [
  { label: BASIC },
  { label: ADVANCED },
  {
    label: SCRIPT,
    disabled: true,
  },
];

export const CUSTOM_TABS = {
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: [{ label: BASIC }],
};
