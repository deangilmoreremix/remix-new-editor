import validator from 'validator';

import { TYPES, WEBHOOK_REGEX } from './constants/validator';

export const isEmail = ({ message = 'It should be email' } = {}) => value => (!validator.isEmail(value) ? message : null);
export const isNumber = ({ message = 'It should be number', ...restOptions } = {}) => value => (!validator.isFloat(value, restOptions) ? message : null);
export const number = ({ message = 'It should be number' } = {}) => value => (Number.isNaN(parseFloat(value, 10)) ? message : null);
export const positive = ({ message = 'It should be positive value' } = {}) => value => (value <= 0 ? message : null);
export const required = ({ message = 'The field is required' } = {}) => value => (!value && value !== 0 ? message : null);
export const matchField = ({ message = 'Field doesn\'t match', matchingField }) => {
  if (!matchingField) {
    throw new Error('matchingField is not provided');
  }
  return (value, values) => (value !== values[matchingField] ? message : null);
};
export const minLength = ({ message, value = '', length }) => {
  if (!length || (value && value.length >= length)) {
    return;
  }
  return message || `Entered value must be at least ${length} characters length.`;
};
export const maxTextLength = ({ value = '', message, length = 60 }) => {
  const str = value.replace(/{{up |{{d |{{|}}/gi, '');
  if (!str || str.length < length) {
    return;
  }
  return message || 'This is the maximum length of current text';
};
export const wrongPattern = ({ message, value, pattern = '' } = {}) => {
  if (!pattern || !value) {
    return;
  }
  const regExp = new RegExp(pattern);

  return regExp.test(value) ? null : message;
};

export const wrongWebhook = ({
  message = 'Incorrect Webhook',
  value,
  pattern = WEBHOOK_REGEX,
}) => wrongPattern({ message, value, pattern });

const isUrl = ({ value: url, message = 'Incorrect Url' }) => {
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch (err) {
    return message;
  }
};

export default {
  isEmail,
  isNumber,
  number,
  positive,
  required,
  matchField,
  minLength,
  wrongPattern,
  maxTextLength,
  [TYPES.URL]: isUrl,
  [TYPES.WEBHOOK]: wrongWebhook,
};
