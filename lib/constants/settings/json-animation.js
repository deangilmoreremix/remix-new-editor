export const JSON_ANIMATION = 'json-animation';

export const BASIC = 'BASIC';
export const ADVANCED = 'ADVANCED';
export const SCRIPT = 'SCRIPT';

export const INITIAL_VALUES = {
  type: JSON_ANIMATION,
  url: '',
};

export const TABS = [
  { label: BASIC },
  { label: ADVANCED },
  {
    label: SCRIPT,
    disabled: true,
  },
];

export const COUNT_FRAMES_IN = 25;
export const COUNT_FRAMES_OUT = 30;
