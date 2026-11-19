/** Plain-language text for people publishing without an account (see lib/guestIdentity.js). */

export const GUEST_NOTICE = 'You\'re publishing without an account. Your videos and links work for everyone you share them with, and are kept for 30 days after they were last used. Sign in to keep them for good.';

const BY_CODE = [
  [/guest_limit_videos/, 'You\'ve reached 10 published videos without an account. Sign in to publish more.'],
  [/guest_limit_links/, 'You\'ve reached 200 personal links without an account. Sign in to create more.'],
  [/guest_not_allowed_slug|guest_not_allowed_business/, 'Readable link names need an account. Your /watch link works without one.'],
  [/guest_rate_limited/, 'Too many new guest sessions from this network. Please try again later or sign in.'],
];

/** The message to show for an error thrown while publishing or managing links, or the original one. */
export function friendlyPublishError(err, fallback = '') {
  const text = [err?.code, err?.message, err?.details, err?.hint].filter(Boolean).join(' ');
  for (const [re, msg] of BY_CODE) if (re.test(text)) return msg;
  return err?.message || fallback;
}
