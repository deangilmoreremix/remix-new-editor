import JsonAnimation from '../../../components/settings/json-animation/JsonAnimation';
import { INITIAL_VALUES as jsonAnimationValues, JSON_ANIMATION } from './json-animation';

export const SETTINGS_COMPONENTS = {
  [JSON_ANIMATION]: JsonAnimation,
};

export const DEFAULT_SETTINGS = {
  [JSON_ANIMATION]: jsonAnimationValues,
};
