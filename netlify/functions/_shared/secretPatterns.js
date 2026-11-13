// One list of secret-looking strings, used both to redact what a user pastes into Ask SmartVideo
// (runtime, askSearch.js) and to refuse to build an index that contains one (scripts/build-ask-index.mjs).
// Pure and dependency-free so a Node build script can import it.
// `strict` is for the index-build validator, where a false positive is fatal: real OpenAI keys are 40+ characters,
// so require 32+ and don't trip on ordinary hyphenated text such as "sk-learn-guide-2024".
const KEYS = (strict) => [
  strict ? 'sk-[A-Za-z0-9_-]{32,}' : 'sk-[A-Za-z0-9_-]{16,}', // OpenAI-style
  '(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{10,}', // Stripe
  'whsec_[A-Za-z0-9]{10,}', // Stripe webhook
  'gh[pousr]_[A-Za-z0-9]{20,}', // GitHub tokens
  'github_pat_[A-Za-z0-9_]{20,}', // GitHub fine-grained PAT
  'glpat-[A-Za-z0-9_-]{16,}', // GitLab PAT
  'AKIA[0-9A-Z]{16}', // AWS access key id
  'xox[abprs]-[A-Za-z0-9-]{10,}', // Slack
  'AIza[0-9A-Za-z_-]{20,}', // Google API key
  'eyJ[A-Za-z0-9_-]{15,}\\.[A-Za-z0-9_-]{15,}\\.[A-Za-z0-9_-]{10,}', // JWT
];
// An Authorization header value. The scheme is case-insensitive, and [ \t] (not \s) keeps it from running onto the next line.
const BEARER = '[Bb][Ee][Aa][Rr][Ee][Rr][ \\t]+[A-Za-z0-9._~+/-]{20,}=*';

/** A fresh RegExp each call (a shared /g regex keeps lastIndex between uses). */
export const secretRegex = (flags = '', { strict = false } = {}) => new RegExp(`\\b(?:${KEYS(strict).join('|')})|\\b${BEARER}`, flags);
