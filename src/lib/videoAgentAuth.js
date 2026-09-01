// SmartVideo auth identity bridge for the Video Agent Studio.
//
// The Video Agent Studio is embedded as an iframe running on a separate
// origin (`http://localhost:3200` in dev, or the same origin when built
// statically and served from `/video-agent-studio/`). It must NOT be
// allowed to trust browser-supplied `userId` values.
//
// This module exposes a single `resolveSmartVideoAuthIdentity()` that
// reads the current SmartVideo Clerk session, derives the user identity
// from it, and hands it to the iframe through a controlled postMessage
// handshake. See `VideoAgentStudioShell.js` for the handshake contract.
//
// Security notes:
//
// * The shell only ever posts the identity to origins it has already
//   accepted as the studio's origin (see `isSameStudioOrigin`).
// * The shell never sends provider secrets, never sends Clerk session
//   tokens, and never sends the user's private profile data. The
//   iframe is expected to call back into the SmartVideo backend with
//   its own authenticated session if it needs anything beyond an id.
// * The returned identity always has `isAuthenticated: false` if Clerk
//   has not reported a signed-in user, even in development.

const READY_TIMEOUT_MS = 5_000;

/**
 * Wait for `window.Clerk` to exist and be loaded. Returns the live Clerk
 * instance or `null` if the timeout expires.
 */
function waitForClerk(timeoutMs = READY_TIMEOUT_MS) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    const start = Date.now();
    const tick = () => {
      const c = window.Clerk;
      if (c && (c.loaded || c.isReady)) return resolve(c);
      if (Date.now() - start > timeoutMs) return resolve(null);
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

/**
 * Derive the SmartVideo-authenticated user identity for the embedded
 * Video Agent Studio. Falls back to an anonymous identity in non-prod
 * previews where Clerk isn't ready yet.
 *
 * @returns {Promise<{id: string|null, email: string|null, isAuthenticated: boolean, source: string}>}
 */
export async function resolveSmartVideoAuthIdentity() {
  try {
    const clerk = await waitForClerk();
    if (clerk && clerk.user) {
      const u = clerk.user;
      return {
        id: u.id || null,
        email: u.primaryEmailAddress?.emailAddress || u.emailAddresses?.[0]?.emailAddress || null,
        isAuthenticated: true,
        source: 'clerk',
      };
    }
  } catch (_) {
    // ignore — fall through to anonymous
  }
  return {
    id: null,
    email: null,
    isAuthenticated: false,
    source: 'anonymous',
  };
}
