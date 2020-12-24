export const TYPES = {
  URL: 'isUrl',
  WEBHOOK: 'webhook',
  MAX_TEXT_LENGTH: 'maxTextLength',
};

export const VALIDATION_TYPES = {
  WARNING: 'warning',
  ERROR: 'error',
};

// eslint-disable-next-line no-useless-escape
export const WEBHOOK_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/;
