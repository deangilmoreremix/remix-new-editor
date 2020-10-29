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
