// Host-app sign-in for the SmartVideo embed.
//
// When the server runs behind the Clerk gateway (CINEGEN_AUTH=clerk), the
// embedding page sends the signed-in user's Clerk token via postMessage. We
// exchange it for the gateway's session cookie before the app starts, and
// keep exchanging fresh tokens so the session follows the host's sign-in.

const TOKEN_REQUEST = 'cinegen:token-request';
const TOKEN_RESPONSE = 'cinegen:token';
const REFRESH_MS = 10 * 60 * 1000;
const TOKEN_TIMEOUT_MS = 15_000;

interface AuthConfig {
  mode: string;
  allowedOrigins: string[];
}

async function fetchAuthConfig(): Promise<AuthConfig | null> {
  try {
    const response = await fetch('/api/auth/config', { credentials: 'same-origin' });
    if (!response.ok) return null;
    const body = await response.json();
    return body?.result ?? null;
  } catch {
    return null;
  }
}

function requestToken(allowedOrigins: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    if (window.parent === window) {
      reject(new Error('Open CineGen from the SmartVideo CineGen Studio to sign in.'));
      return;
    }
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Timed out waiting for sign-in from the host app.'));
    }, TOKEN_TIMEOUT_MS);

    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      if (allowedOrigins.length && !allowedOrigins.includes(event.origin)) return;
      if (event.data?.type !== TOKEN_RESPONSE) return;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      if (typeof event.data.token === 'string' && event.data.token) resolve(event.data.token);
      else reject(new Error('Sign in to SmartVideo to use CineGen.'));
    }

    window.addEventListener('message', onMessage);
    // The token is only sent back to an allowed origin, so the target can be '*'.
    window.parent.postMessage({ type: TOKEN_REQUEST }, '*');
  });
}

async function exchangeToken(token: string): Promise<void> {
  const response = await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Your SmartVideo session could not be verified. Sign in again.');
}

/** Resolves once the user is signed in (or immediately when auth is off). */
export async function ensureHostSession(): Promise<void> {
  const config = await fetchAuthConfig();
  if (!config || config.mode !== 'clerk') return;

  await exchangeToken(await requestToken(config.allowedOrigins));

  window.setInterval(() => {
    requestToken(config.allowedOrigins)
      .then(exchangeToken)
      .catch((error) => console.warn('[cinegen] session refresh failed', error));
  }, REFRESH_MS);
}
