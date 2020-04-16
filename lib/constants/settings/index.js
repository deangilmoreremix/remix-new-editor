import JsonAnimation from '../../../components/settings/json-animation/JsonAnimation';
import { INITIAL_VALUES as jsonAnimationValues } from './json-animation';
import { POPCORN_ELEMENT_TYPES } from '../popcorn';

export const SETTINGS_COMPONENTS = {
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: JsonAnimation,
};

export const DEFAULT_SETTINGS = {
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: jsonAnimationValues,
};
