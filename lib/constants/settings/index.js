import JsonAnimation from '../../../components/settings/json-animation/JsonAnimation';
import ImageSettings from '../../../components/settings/image-settings/ImageSettings';
import TextSettings from '../../../components/settings/text-settings/TextSettings';
import { INITIAL_VALUES as jsonAnimationValues } from './json-animation';
import { INITIAL_VALUES as imageValues } from './image';
import { POPCORN_ELEMENT_TYPES } from '../popcorn';
import { INITIAL_VALUES as vrtextValues } from './vrtext-element';

export const SETTINGS_COMPONENTS = {
  [POPCORN_ELEMENT_TYPES.TEXT]: TextSettings,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: JsonAnimation,
  [POPCORN_ELEMENT_TYPES.IMAGE]: ImageSettings,
};

export const DEFAULT_SETTINGS = {
  [POPCORN_ELEMENT_TYPES.TEXT]: vrtextValues,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: jsonAnimationValues,
  [POPCORN_ELEMENT_TYPES.IMAGE]: imageValues,
};
