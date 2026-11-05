import { auth } from '../../shims/clerk-server';
import { currentRequestContext } from '../../shims/requestContext';

/**
 * remix-new-editor version of OpenHiggsBolt's server-side OpenAI key lookup.
 *
 * OpenHiggsBolt stored each user's OpenAI key encrypted in `app_users`.
 * remix keeps the user's own key in the browser (Settings → apiKeyManager);
 * the client sends it on personalization requests as `x-openai-key` (see
 * src/features/personalization/lib/apiAuth.ts). Without one this returns
 * null, exactly as OpenHiggsBolt did for a user with no stored key.
 * Signed-out callers get null.
 */
export async function getOpenAiKeyForUser(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const header = currentRequestContext()?.request.headers.get('x-openai-key')?.trim();
  if (header && /^sk-[A-Za-z0-9_\-]{10,}$/.test(header)) return header;

  // No site-wide fallback: like OpenHiggsBolt, a user without their own key
  // gets the route's "no key" error instead of billing the deployment.
  return null;
}
