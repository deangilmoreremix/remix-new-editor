import svgTextLeft from '../../../public/static/svgImages/text/basic_group/text-icon-left.svg';
import svgTextCenter from '../../../public/static/svgImages/text/basic_group/text-icon-center.svg';
import svgTextRight from '../../../public/static/svgImages/text/basic_group/text-icon-right.svg';
import svgTextPositionTop from '../../../public/static/svgImages/text/basic_group/text-position-top.svg';
import svgTextPositionCenter from '../../../public/static/svgImages/text/basic_group/text-position-center.svg';
import svgTextPositionBottom from '../../../public/static/svgImages/text/basic_group/text-position-bottom.svg';
import svgTextLeftChecked from '../../../public/static/svgImages/text/basic_group/text-icon-left-checked.svg';
import svgTextCenterChecked from '../../../public/static/svgImages/text/basic_group/text-icon-center-checked.svg';
import svgTextRightChecked from '../../../public/static/svgImages/text/basic_group/text-icon-right-checked.svg';
import svgTextPositionTopChecked from '../../../public/static/svgImages/text/basic_group/text-position-top-checked.svg';
import svgTextPositionCenterChecked from '../../../public/static/svgImages/text/basic_group/text-position-center-checked.svg';
import svgTextPositionBottomChecked from '../../../public/static/svgImages/text/basic_group/text-position-bottom-checked.svg';
import svgAlignmentLeft from '../../../public/static/svgImages/text/advanced/text-align-left.svg';
import svgAlignmentCenter from '../../../public/static/svgImages/text/advanced/text-align-center.svg';
import svgAlignmentRight from '../../../public/static/svgImages/text/advanced/text-align-right.svg';
import svgAlignmentLeftChecked from '../../../public/static/svgImages/text/advanced/text-align-left-checked.svg';
import svgAlignmentCenterChecked from '../../../public/static/svgImages/text/advanced/text-align-center-checked.svg';
import svgAlignmentRightChecked from '../../../public/static/svgImages/text/advanced/text-align-right-checked.svg';

export const VRTEXT = 'text';
export const BASIC = 'BASIC';
export const ADVANCED = 'ADVANCED';

export const SCRIPT = 'SCRIPT';

export const iconAlignment = [
  { value: 'left', icon: svgTextLeft, checkedIcon: svgTextLeftChecked },
  { value: 'center', icon: svgTextCenter, checkedIcon: svgTextCenterChecked },
  { value: 'right', icon: svgTextRight, checkedIcon: svgTextRightChecked },
];
export const iconPosition = [
  { value: 'top', icon: svgTextPositionTop, checkedIcon: svgTextPositionTopChecked },
  { value: 'middle', icon: svgTextPositionCenter, checkedIcon: svgTextPositionCenterChecked },
  { value: 'bottom', icon: svgTextPositionBottom, checkedIcon: svgTextPositionBottomChecked },
];

export const iconAlignmentAdvanced = [
  { value: 'left', icon: svgAlignmentLeft, checkedIcon: svgAlignmentLeftChecked },
  { value: 'center', icon: svgAlignmentCenter, checkedIcon: svgAlignmentCenterChecked },
  { value: 'right', icon: svgAlignmentRight, checkedIcon: svgAlignmentRightChecked },
];

export const INITIAL_VALUES = {
  type: VRTEXT,
  top: 20,
  left: 30,
  width: 40,
  height: 40,
  zindex: 1000,
};

export const TABS = [
  { label: BASIC },
  { label: ADVANCED },
  {
    label: SCRIPT,
    disabled: true,
  },
];
