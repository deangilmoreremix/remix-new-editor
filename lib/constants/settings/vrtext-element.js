import svgTextLeft from '../../../public/static/svgImages/text/basic_group/text-icon-left.svg';
import svgTextCenter from '../../../public/static/svgImages/text/basic_group/text-icon-center.svg';
import svgTextRight from '../../../public/static/svgImages/text/basic_group/text-icon-right.svg';
import svgTextPositionTop from '../../../public/static/svgImages/text/basic_group/text-position-top.svg';
import svgTextPositionCenter from '../../../public/static/svgImages/text/basic_group/text-position-center.svg';
import svgTextPositionBottom from '../../../public/static/svgImages/text/basic_group/text-position-bottom.svg';
import svgAlignmentLeft from '../../../public/static/svgImages/text/advanced/text-align-left.svg';
import svgAlignmentCenter from '../../../public/static/svgImages/text/advanced/text-align-center.svg';
import svgAlignmentRight from '../../../public/static/svgImages/text/advanced/text-align-right.svg';
import { ADVANCED, BASIC, SCRIPT, VRTEXT } from './common';

export const POSITION_CUSTOM = 'custom';

export const iconAlignment = [
  { value: 'left', icon: svgTextLeft },
  { value: 'center', icon: svgTextCenter },
  { value: 'right', icon: svgTextRight },
];
export const iconPosition = [
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
  type: VRTEXT,
};

export const TABS = [
  { label: BASIC },
  { label: ADVANCED },
  {
    label: SCRIPT,
    disabled: true,
  },
];
