/**
 * Shared, user-facing error formatting.
 *
 * Centralises the conversion of raw upload / generation errors into concise
 * messages. Authentication (401/403) and insufficient-credit (402) failures are
 * mapped to a single actionable message so users always know to sign in and add
 * credits instead of seeing an opaque technical error.
 */

export function formatErrorMessage(err, fallback = 'Request failed') {
  if (!err) return fallback;

  const message0 = typeof err === 'string' ? err : (err?.message || fallback);
  const status =
    err && typeof err === 'object' && typeof err.status === 'number'
      ? err.status
      : undefined;

  let message = message0;

  // Surface a structured detail if the message embeds a JSON payload.
  if (message.includes('{') && message.includes('}')) {
    try {
      const jsonStr = message.slice(message.indexOf('{'));
      const data = JSON.parse(jsonStr);
      if (data.detail && typeof data.detail === 'string') message = data.detail;
      else if (data.error?.message && typeof data.error.message === 'string') message = data.error.message;
      else if (data.message && typeof data.message === 'string') message = data.message;
    } catch { /* ignore JSON parse errors */ }
  }

  const m = message.toLowerCase();

  const isAuth =
    status === 401 || status === 403 ||
    m.includes('unauthoriz') ||
    m.includes('api key not configured') ||
    m.includes('not configured') ||
    m.includes('sign in') ||
    m.includes('forbidden') ||
    m.includes('401') ||
    m.includes('403');

  const isCredit =
    status === 402 || status === 422 ||
    m.includes('insufficient credit') ||
    m.includes('402') ||
    m.includes('credit') ||
    m.includes('payment') ||
    m.includes('quota') ||
    m.includes('balance') ||
    m.includes('subscribe') ||
    m.includes('expired') ||
    m.includes('plan');

  if (isAuth || isCredit) {
    return 'Please sign in and add api credits.';
  }

  if (status === 429 || m.includes('429')) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  message = message.replace(/^API Request Failed: \d+ [^-]+ - /, '');
  return message.length > 150 ? message.slice(0, 147) + '...' : message;
}
