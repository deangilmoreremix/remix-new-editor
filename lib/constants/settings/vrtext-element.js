import svgTextLeft from '../../../public/static/svgImages/text/basic_group/text-icon-left.svg';
import svgTextCenter from '../../../public/static/svgImages/text/basic_group/text-icon-center.svg';
import svgTextRight from '../../../public/static/svgImages/text/basic_group/text-icon-right.svg';
import svgTextPositionTop from '../../../public/static/svgImages/text/basic_group/text-position-top.svg';
import svgTextPositionCenter from '../../../public/static/svgImages/text/basic_group/text-position-center.svg';
import svgTextPositionBottom from '../../../public/static/svgImages/text/basic_group/text-position-bottom.svg';
import svgAlignmentLeft from '../../../public/static/svgImages/text/advanced/text-align-left.svg';
import svgAlignmentCenter from '../../../public/static/svgImages/text/advanced/text-align-center.svg';
import svgAlignmentRight from '../../../public/static/svgImages/text/advanced/text-align-right.svg';

import {
  BACKGROUND,
  BOLD,
  FIELD_TEXT,
  FONT_COLOR,
  FONT_DECORATIONS,
  FONT_SIZE,
  ITALICS,
  POPCORN_ELEMENT_TYPES,
  RESPONSIVE,
  SHADOW,
  STROKE,
  TOP,
  WIDTH,
  HEIGHT,
  LEFT,
} from '../popcorn';

export const padding = 3;

export const TEXT_POSITION = {
  TOP: 'top',
  BOTTOM: 'bottom',
  MIDDLE: 'middle',
  LEFT: 'left',
  RIGHT: 'right',
  CENTER: 'center',
  CUSTOM: 'custom',
};

export const iconAlignmentHorizontal = [
  { value: TEXT_POSITION.LEFT, icon: svgTextLeft },
  { value: TEXT_POSITION.CENTER, icon: svgTextCenter },
  { value: TEXT_POSITION.RIGHT, icon: svgTextRight },
];

export const iconPositionVertical = [
  { value: 'top', icon: svgTextPositionTop },
  { value: 'middle', icon: svgTextPositionCenter },
  { value: 'bottom', icon: svgTextPositionBottom },
];

export const iconAlignmentAdvanced = [
  { value: 'left', icon: svgAlignmentLeft },
  { value: 'center', icon: svgAlignmentCenter },
  { value: 'right', icon: svgAlignmentRight },
];

export const INITIAL_VALUES = {
  type: POPCORN_ELEMENT_TYPES.TEXT,
  [FIELD_TEXT]: 'Enter Text Here',
  [FONT_COLOR]: '#FFFFFF',
  [FONT_DECORATIONS]: {
    [BOLD]: false,
    [ITALICS]: false,
    [RESPONSIVE]: true,
  },
  [SHADOW]: false,
  [BACKGROUND]: false,
  [STROKE]: false,
  [FONT_SIZE]: 8,
  [TOP]: 42,
  [WIDTH]: 22,
  [LEFT]: 39,
  [HEIGHT]: 10,
};

export const WARNING = 'Warning';
export const CONTENT_RESPONSIVE = 'Disabling of Scale to Fit '
  + 'option may lead to losing responsiveness of your text on different screen sizes.';
