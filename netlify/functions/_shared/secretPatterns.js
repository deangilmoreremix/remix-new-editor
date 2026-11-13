// One list of secret-looking strings, used both to redact what a user pastes into Ask SmartVideo
// (runtime, askSearch.js) and to refuse to build an index that contains one (scripts/build-ask-index.mjs).
// Pure and dependency-free so a Node build script can import it.
const KEYS = [
  'sk-[A-Za-z0-9_-]{16,}', // OpenAI-style
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
const BEARER = 'Bearer\\s+[A-Za-z0-9._~+/-]{20,}=*'; // an Authorization header value

/** A fresh RegExp each call (a shared /g regex keeps lastIndex between uses). */
export const secretRegex = (flags = '') => new RegExp(`\\b(?:${KEYS.join('|')})|\\b${BEARER}`, flags);
