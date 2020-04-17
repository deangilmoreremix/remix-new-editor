import JsonAnimation from '../../../components/settings/json-animation/JsonAnimation';
import TextElement from '../../../components/settings/text-settings/TextElement';
import { INITIAL_VALUES as jsonAnimationValues, JSON_ANIMATION } from './json-animation';
import { INITIAL_VALUES as vrtextValues } from './vrtext-element';
import { VRTEXT } from './common';
import { POPCORN_ELEMENT_TYPES } from '../popcorn';

export const SETTINGS_COMPONENTS = {
  [JSON_ANIMATION]: JsonAnimation,
  [VRTEXT]: TextElement,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: JsonAnimation,
};

export const DEFAULT_SETTINGS = {
  [JSON_ANIMATION]: jsonAnimationValues,
  [VRTEXT]: vrtextValues,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: jsonAnimationValues,
};
