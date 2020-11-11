import { POPCORN_ELEMENT_TYPES } from '../popcorn';

export const INITIAL_VALUES = {
  type: POPCORN_ELEMENT_TYPES.RETARGET,
  kind: POPCORN_ELEMENT_TYPES.RETARGET,
  showed: true,
  isPersonalizer: false,
};

export const INPUT_VALUE = 'inputValue';

export const ARRAY_TRANSITIONS = [
  { label: 'None', value: 'popcorn-none' },
  { label: 'Pop', value: 'popcorn-pop' },
  { label: 'Fade', value: 'popcorn-fade' },
  { label: 'Fade In', value: 'popcorn-fade-in' },
  { label: 'Fade In Up', value: 'popcorn-fade-in-up' },
  { label: 'Slide Up', value: 'popcorn-slide-up' },
  { label: 'Slide Down', value: 'popcorn-slide-down' },
  { label: 'Swivel In (Y-axis)', value: 'popcorn-swivel-y' },
  { label: 'Swivel In (X-axis)', value: 'popcorn-swivel-x' },
  { label: 'Typing Effect', value: 'popcorn-typing-form' },
  { label: 'Blur (White)', value: 'popcorn-blur-w' },
  { label: 'Wobble Vertical', value: 'popcorn-wobble-vertical' },
  { label: 'Wobble Horizontal', value: 'popcorn-wobble-horizontal' },
  { label: 'Wobble Diagonal', value: 'popcorn-wobble-diagonal' },
  { label: 'Pulse (Looped)', value: 'popcorn-pulse' },
  { label: 'Push', value: 'popcorn-push' },
  { label: 'Bob', value: 'popcorn-bob' },
  { label: 'Buzz', value: 'popcorn-buzz' },
  { label: 'Buzz out', value: 'popcorn-buzz-out' },
  { label: 'Stroke Pulse (Looped)', value: 'popcorn-stroke-pulse' },
  { label: 'Flicker', value: 'animate-flicker' },
];
export const ARRAY_ELEMENTS_RETARGET = [
  { label: 'Singleline', value: 'singleline', type: 'singleline', token: 'Singleline' },
  { label: 'Multiline', value: 'multiline', type: 'multiline', token: 'Multiline' },
  { label: 'Email', value: 'email', type: 'email', token: 'Email' },
  { label: 'Number', value: 'number', type: 'number', token: 'Number' },
  { label: 'Date', value: 'date', type: 'date', token: 'Date' },
];

export const DEFAULT_OPTIONS = {
  start: 0,
  end: 0,
  target: 'video-container',
};

export const DEFAULT_OPTIONS_OPTIN = {
  start: 0,
  end: 0,
  target: 'video-container',
  fontFamily: 'Coda',
  backgroundColor: '#5517c3',
  btnBottomBorder: '#bd3e20',
  buttonBackground: '#ff5908',
  innerWidth: 90,
  captionFontSize: 100,
  fontSize: 100,
  elements: [
    {
      id: 0,
      label: 'Email',
      name: 'inputValue',
      token: 'EMAIL',
      type: 'email',
      value: 'email',
    },
    {
      id: 2,
      label: 'First Name',
      name: 'inputValue',
      token: 'FIRST NAME',
      type: 'singleline',
      value: 'singleline',
    },
    {
      id: 3,
      label: 'Last name',
      name: 'inputValue',
      token: 'LAST NAME',
      type: 'singleline',
      value: 'singleline',
    },
  ],
};
