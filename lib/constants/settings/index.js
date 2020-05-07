import JsonAnimation from '../../../components/settings/json-animation/JsonAnimation';
import ImageSettings from '../../../components/settings/image-settings/ImageSettings';
import TextSettings from '../../../components/settings/text-settings/TextSettings';
import VrImageSettings from '../../../components/settings/vr-image/VrImageSettings';
import VideoTransitionSettings from '../../../components/settings/video-transition-settings/VideoTransitionSettings';
// todo fix it and fix images menu
import { INITIAL_VALUES as jsonAnimationValues } from './json-animation';
import { INITIAL_VALUES as imageValues } from './image';
import { POPCORN_ELEMENT_TYPES, ADVANCED, BASIC, SCRIPT } from '../popcorn';
import { INITIAL_VALUES as vrtextValues } from './vrtext-element';
import { INITIAL_VALUES as vrImageValues } from './vr-image';
import { INITIAL_VALUES as videoTransitionValues } from './video-transition';

export const SETTINGS_COMPONENTS = {
  [POPCORN_ELEMENT_TYPES.TEXT]: TextSettings,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: JsonAnimation,
  [POPCORN_ELEMENT_TYPES.IMAGE]: ImageSettings,
  [POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE]: VrImageSettings,
  [POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION]: VideoTransitionSettings,
};

export const DEFAULT_SETTINGS = {
  [POPCORN_ELEMENT_TYPES.TEXT]: vrtextValues,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: jsonAnimationValues,
  [POPCORN_ELEMENT_TYPES.IMAGE]: imageValues,
  [POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE]: vrImageValues,
  [POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION]: videoTransitionValues,
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
  [POPCORN_ELEMENT_TYPES.IMAGE]: [{ label: BASIC }],
  [POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE]: [{ label: BASIC }],
};
