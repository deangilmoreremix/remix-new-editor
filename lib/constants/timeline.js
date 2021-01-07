import { DURATION, LOOP, POPCORN_ELEMENT_TYPES } from './popcorn';
import AnimatableElement from '../../components/common/timeline/elements/AnimatableElement';
import DefaultElement from '../../components/common/timeline/elements/DefaultElement';
import IconElement from '../../components/common/timeline/elements/IconElement';

import svgTransitionIcon from '../../public/static/svgImages/transitions/icon-transition.svg';
import svgPauseIcon from '../../public/static/svgImages/popcorn/pause.svg';
import svgLoopIcon from '../../public/static/svgImages/popcorn/loop.svg';
import svgOverlayIcon from '../../public/static/svgImages/popcorn/overlay.svg';
import svgInfiniteIcon from '../../public/static/svgImages/popcorn/infinite.svg';
import svgSkipIcon from '../../public/static/svgImages/popcorn/skip.svg';
import svgMapsIcon from '../../public/static/svgImages/popcorn/maps.svg';
import svgSocialIcon from '../../public/static/svgImages/popcorn/social.svg';
import svgVideoIcon from '../../public/static/images/media/icon-video.svg';

export const TIMELINE_COMPONENTS = {
  [POPCORN_ELEMENT_TYPES.TEXT]: AnimatableElement,
  [POPCORN_ELEMENT_TYPES.LEAD_GENERATOR]: AnimatableElement,
  [POPCORN_ELEMENT_TYPES.LOTTIE_JSON]: DefaultElement,
  [POPCORN_ELEMENT_TYPES.IMAGE]: AnimatableElement,
  [POPCORN_ELEMENT_TYPES.JSON_ANIMATION]: DefaultElement,
  [POPCORN_ELEMENT_TYPES.PERSONALIZED_IMAGE]: DefaultElement,
  [POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION]: IconElement,
  [POPCORN_ELEMENT_TYPES.SOCIAL]: IconElement,
  [POPCORN_ELEMENT_TYPES.PAUSE]: IconElement,
  [POPCORN_ELEMENT_TYPES.LOOP]: IconElement,
  [POPCORN_ELEMENT_TYPES.JSON_TRANSITION]: IconElement,
  [POPCORN_ELEMENT_TYPES.SKIP]: IconElement,
  [POPCORN_ELEMENT_TYPES.GOOGLE_MAP]: IconElement,
  [POPCORN_ELEMENT_TYPES.SEQUENCER]: IconElement,
  [POPCORN_ELEMENT_TYPES.TEXT_MASK]: DefaultElement,
  [POPCORN_ELEMENT_TYPES.COMBINED]: DefaultElement,
};

export const TIMELINE_ELEMENT_ICONS = {
  [POPCORN_ELEMENT_TYPES.VIDEO_TRANSITION]: svgTransitionIcon,
  [POPCORN_ELEMENT_TYPES.PAUSE]: svgPauseIcon,
  [POPCORN_ELEMENT_TYPES.LOOP]: svgLoopIcon,
  [POPCORN_ELEMENT_TYPES.JSON_TRANSITION]: svgOverlayIcon,
  [POPCORN_ELEMENT_TYPES.SKIP]: svgSkipIcon,
  [POPCORN_ELEMENT_TYPES.GOOGLE_MAP]: svgMapsIcon,
  [POPCORN_ELEMENT_TYPES.SOCIAL]: svgSocialIcon,
  [POPCORN_ELEMENT_TYPES.SEQUENCER]: svgVideoIcon,
};

export const TIMELINE_ELEMENT_DEFAULT_ICONS = {
  [POPCORN_ELEMENT_TYPES.PAUSE]: svgInfiniteIcon,
  [POPCORN_ELEMENT_TYPES.LOOP]: svgInfiniteIcon,
};

export const TIMELINE_ELEMENT_DEFAULT_FIELD = {
  [POPCORN_ELEMENT_TYPES.PAUSE]: DURATION,
  [POPCORN_ELEMENT_TYPES.LOOP]: LOOP,
};

export const isTimelineString = (value) => /\d|:|\./.test(value);
