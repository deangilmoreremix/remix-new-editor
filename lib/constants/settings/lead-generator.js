import { POPCORN_ELEMENT_TYPES } from '../popcorn';
import { LEAD_GENERATOR_TEXT } from '../text-info';

export const INPUT_VALUE = 'inputValue';

export const INITIAL_VALUES = {
  type: POPCORN_ELEMENT_TYPES.LEAD_GENERATOR,
  elements:
    [{
      type: 'email',
      label: 'Email',
      value: 'email',
      token: 'EMAIL',
      id: 0,
      name: INPUT_VALUE,
    }],
  privacyDisclaimer: LEAD_GENERATOR_TEXT.disclaimer,
};

export const TRANSITIONS_LEAD_GENERATOR = [
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
export const ELEMENTS_LEAD_GENERATOR = [
  { label: 'Singleline', value: 'singleline', type: 'singleline', token: 'Singleline' },
  { label: 'Multiline', value: 'multiline', type: 'multiline', token: 'Multiline' },
  { label: 'Email', value: 'email', type: 'email', token: 'Email' },
  { label: 'Number', value: 'number', type: 'number', token: 'Number' },
  { label: 'Date', value: 'date', type: 'date', token: 'Date' },
];
