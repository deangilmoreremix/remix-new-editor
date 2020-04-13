import JsonAnimation from '../../../components/settings/json-animation/JsonAnimation';
import VRTEXTPresets from '../../../components/settings/text-settings/TextElement';
import { INITIAL_VALUES as jsonAnimationValues, JSON_ANIMATION } from './json-animation';
import { INITIAL_VALUES as vrtextPresetValues, VRTEXT_PRESET } from './vrtext-preset';

export const SETTINGS_COMPONENTS = {
  [JSON_ANIMATION]: JsonAnimation,
  [VRTEXT_PRESET]: VRTEXTPresets,
};

export const DEFAULT_SETTINGS = {
  [JSON_ANIMATION]: jsonAnimationValues,
  [VRTEXT_PRESET]: vrtextPresetValues,
};
