/**
 * A path inside Cal.diy to land on after an SSO sign-in. Anything else (another site, a protocol-relative URL,
 * backslashes) becomes the default, so the bridge page can never be used as an open redirect.
 * Kept free of server imports so the browser page can use it too.
 */
export function safeNextPath(next: unknown, fallback = "/event-types"): string {
  const s = typeof next === "string" ? next.trim() : "";
  const ok = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/.test(s) && !s.includes("\\");
  return ok ? s : fallback;
}
