import JsonAnimation from '../../../components/settings/json-animation/JsonAnimation';
import TextElement from '../../../components/settings/text-settings/TextElement';
import { INITIAL_VALUES as jsonAnimationValues, JSON_ANIMATION } from './json-animation';
import { INITIAL_VALUES as vrtextValues, VRTEXT } from './vrtext-element';

export const SETTINGS_COMPONENTS = {
  [JSON_ANIMATION]: JsonAnimation,
  [VRTEXT]: TextElement,
};

export const DEFAULT_SETTINGS = {
  [JSON_ANIMATION]: jsonAnimationValues,
  [VRTEXT]: vrtextValues,
};
