import SVGPresets from '../../../components/settings/svg-preset/SVGPresets';
import { INITIAL_VALUES as svgPresetValues, SVG_PRESET } from './svg-preset';

export const SETTINGS_COMPONENTS = {
  [SVG_PRESET]: SVGPresets,
};

export const DEFAULT_SETTINGS = {
  [SVG_PRESET]: svgPresetValues,
};
