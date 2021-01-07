export const TYPES = {
  URL: 'isUrl',
  WEBHOOK: 'webhook',
  PHONE_URL: 'phone-url',
  EMAIL: 'email',
  MAX_TEXT_LENGTH: 'maxTextLength',
};

export const VALIDATION_TYPES = {
  WARNING: 'warning',
  ERROR: 'error',
};

// eslint-disable-next-line no-useless-escape
export const WEBHOOK_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/;
// eslint-disable-next-line no-useless-escape
export const PHONE_URL_REGEX = /^[+]?\d[0-9-*]{8,15}$|^((https?|ftp)\:\/\/)?([a-z0-9]{1})((\.[a-z0-9-])|([a-z0-9-]))*\.([a-z]{2,6})(\/?)$/;
// eslint-disable-next-line no-useless-escape
export const EMAIL_REGEX = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
