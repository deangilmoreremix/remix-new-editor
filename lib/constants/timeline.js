import { POPCORN_ELEMENT_TYPES } from './popcorn';
import AnimatableElement from '../../components/common/timeline/elements/AnimatableElement';
import DefaultElement from '../../components/common/timeline/elements/DefaultElement';
import IconElement from '../../components/common/timeline/elements/IconElement';
import PauseElement from '../../components/common/timeline/elements/PauseElement';

import svgTransitionIcon from '../../public/static/svgImages/transitions/icon-transition.svg';

export const TIMELINE_COMPONENTS = {
  [POPCORN_ELEMENT_TYPES.TEXT]: AnimatableElement,
  [POPCORN_ELEMENT_TYPES.LOTTIE_JSON]: DefaultElement,
  [POPCORN_ELEMENT_TYPES.IMAGE]: AnimatableElement,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: DefaultElement,
  [POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE]: DefaultElement,
  [POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION]: IconElement,
  [POPCORN_ELEMENT_TYPES.PAUSE]: PauseElement,
};

export const TIMELINE_ELEMENT_ICONS = {
  [POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION]: svgTransitionIcon,
};

export const isTimelineString = (value) => /\d|:|\./.test(value);
