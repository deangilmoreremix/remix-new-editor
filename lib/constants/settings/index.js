import JsonAnimation from '../../../components/settings/json-animation/JsonAnimation';
import { INITIAL_VALUES as jsonAnimationValues } from './json-animation';
import { POPCORN_ELEMENT_TYPES } from '../popcorn';
import TextElement from '../../../components/settings/text-settings/TextElement';
import { INITIAL_VALUES as vrtextValues } from './vrtext-element';
import { VRTEXT } from './common';

export const SETTINGS_COMPONENTS = {
  [VRTEXT]: TextElement,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: JsonAnimation,
};

export const DEFAULT_SETTINGS = {
  [VRTEXT]: vrtextValues,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: jsonAnimationValues,
};
