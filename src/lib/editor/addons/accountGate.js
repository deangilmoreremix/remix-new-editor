/**
 * Features that act on other people's behalf (webhooks, email alerts, thank-you emails, email-list connections) need an account:
 * the server never runs them for a guest-owned video (supabase/functions/lead-capture), so the editor does not offer them
 * to someone publishing without an account.
 */
export const hasAccount = () => {
  try { return !!globalThis.window?.Clerk?.user; } catch { return false; }
};

/** Integration settings a guest is not offered. */
export const ACCOUNT_ONLY_FIELDS = Object.freeze(new Set([
  'webhookEnabled', 'webhook', 'webhook2', 'webhook3', '_webhookTest', '_webhookLog', '_webhookSecret',
  'emailEnabled', 'emailAddress', 'emailAddress2', 'emailAddress3',
  'autoReplyEnabled', 'autoReplySubject', 'autoReplyReplyTo', 'autoReplyBody',
  'espProvider', 'espListId', '_espConnect',
]));

export const ACCOUNT_ONLY_NOTE = 'Webhooks, email alerts, thank-you emails and email-list connections need an account. Sign in to turn them on. Tracking pixels and the throwaway-email block work without one.';
