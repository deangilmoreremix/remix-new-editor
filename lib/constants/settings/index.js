import SVGPresets from '../../../components/settings/svg-preset/SVGPreset';
import VRTEXTPresets from '../../../components/settings/vrtext-preset/VRTEXTPresets';
import { INITIAL_VALUES as svgPresetValues, SVG_PRESET } from './svg-preset';
import { INITIAL_VALUES as vrtextPresetValues, VRTEXT_PRESET } from './vrtext-preset';

export const SETTINGS_COMPONENTS = {
  [SVG_PRESET]: SVGPresets,
  [VRTEXT_PRESET]: VRTEXTPresets,
};

export const DEFAULT_SETTINGS = {
  [SVG_PRESET]: svgPresetValues,
  [VRTEXT_PRESET]: vrtextPresetValues,
};
