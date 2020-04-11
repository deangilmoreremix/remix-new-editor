import VRTEXTPresets from '../../../components/settings/vrtext-preset/VRTEXTPresets';
import { INITIAL_VALUES as vrtextPresetValues, VRTEXT_PRESET } from './vrtext-preset';

export const SETTINGS_COMPONENTS = {
  [VRTEXT_PRESET]: VRTEXTPresets,
};

export const DEFAULT_SETTINGS = {
  [VRTEXT_PRESET]: vrtextPresetValues,
};
