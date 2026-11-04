// supabase/functions/_shared/clerkAuth.ts
//
// Clerk authentication + SmartVideo entitlement gate for Supabase edge
// functions. Deno-only (Web Crypto / global fetch, no npm dependencies).
//
// Enforcement contract (identical semantics in every gated function):
//   1. The request MUST carry a Clerk session token
//      (`Authorization: Bearer <session.getToken()>`). Missing/invalid/expired
//      token  -> HTTP 401 { error: 'AUTH_REQUIRED' }.
//   2. The signed-in user MUST be entitled to SmartVideo AI:
//        - user.publicMetadata.legacy_access === true (legacy purchases), OR
//        - the Clerk Billing feature 'smartvideo_full_access' present in the
//          verified session-token claims.
//      Authenticated but unpaid -> HTTP 403
//      { error: 'PAYMENT_REQUIRED', upgradeRequired: true }.
//   3. Deny BEFORE any provider call or server-key use.
//
// Env vars read:
//   CLERK_ISSUER_URL        (preferred) e.g. https://<app>.clerk.accounts.dev
//   CLERK_PUBLISHABLE_KEY   (fallback)  pk_test_/pk_live_ ... -> issuer decoded
//   VITE_CLERK_PUBLISHABLE_KEY (last resort, if deployed to the edge env)
//   CLERK_SECRET_KEY        required to resolve publicMetadata via the Clerk
//                           Backend API (unless the billing feature claim is
//                           already present in the token).
//
// Usage:
//   const denial = await requireEntitlement(req, corsHeaders);
//   if (denial) return denial;   // 401/403 already rendered
//   // ...proceed: provider calls, server keys, etc.

/** Clerk Billing feature slug that grants full SmartVideo access. */
export const PAID_FEATURE = "smartvideo_full_access";

const CLERK_API_BASE = "https://api.clerk.com/v1";
const JWKS_TTL_MS = 10 * 60 * 1000; // Clerk rotates rarely; cache briefly.
const CLOCK_SKEW_SEC = 60;

export interface ClerkIdentity {
  userId: string;
  email: string | null;
  /** user.publicMetadata.legacy_access === true */
  legacyAccess: boolean;
  /** 'smartvideo_full_access' feature present in the session-token claims. */
  featureFullAccess: boolean;
}

// ---------------------------------------------------------------------------
// Env access — works in Deno (Deno.env) and under Node/vitest (process.env).
// ---------------------------------------------------------------------------

export function readEnv(name: string): string | undefined {
  const denoGlobal = (globalThis as Record<string, unknown>).Deno as
    | { env?: { get?: (name: string) => string | undefined } }
    | undefined;
  const fromDeno = denoGlobal?.env?.get ? denoGlobal.env.get(name) : undefined;
  if (fromDeno) return fromDeno;
  const proc = (globalThis as Record<string, unknown>).process as
    | { env?: Record<string, string | undefined> }
    | undefined;
  const fromNode = proc?.env?.[name];
  return fromNode || undefined;
}

// ---------------------------------------------------------------------------
// JWT plumbing (Web Crypto only)
// ---------------------------------------------------------------------------

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJwtPart<T>(part: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(part))) as T;
  } catch {
    return null;
  }
}

/** Bearer token from the Authorization header, or null when absent. */
export function extractBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  const token = match ? match[1].trim() : "";
  return token || null;
}

// ---------------------------------------------------------------------------
// Issuer + JWKS
// ---------------------------------------------------------------------------

/** Decode the Clerk frontend API host out of a pk_test_/pk_live_ key. */
function issuerFromPublishableKey(pk: string): string | null {
  const raw = pk.replace(/^pk_(test|live)_/, "");
  try {
    const decoded = new TextDecoder().decode(base64UrlDecode(raw));
    const host = decoded.replace(/\$$/, "").trim();
    if (!host) return null;
    return host.startsWith("http") ? host : `https://${host}`;
  } catch {
    return null;
  }
}

/**
 * Resolve the Clerk issuer (JWT `iss` + JWKS host).
 * Order: CLERK_ISSUER_URL -> CLERK_PUBLISHABLE_KEY -> VITE_CLERK_PUBLISHABLE_KEY.
 * Returns null when unconfigured — all callers fail closed in that case.
 */
export function getClerkIssuer(): string | null {
  const configured = readEnv("CLERK_ISSUER_URL");
  if (configured) return configured.replace(/\/+$/, "");
  const publishableKey =
    readEnv("CLERK_PUBLISHABLE_KEY") || readEnv("VITE_CLERK_PUBLISHABLE_KEY");
  if (publishableKey) return issuerFromPublishableKey(publishableKey);
  return null;
}

interface Jwk {
  kid?: string;
  kty?: string;
  [key: string]: unknown;
}

// Keyed by issuer so a rotated/failed instance never poisons another.
const jwksCache = new Map<string, { keys: Jwk[]; expiresAt: number }>();

async function fetchJwks(issuer: string): Promise<Jwk[]> {
  const now = Date.now();
  const cached = jwksCache.get(issuer);
  if (cached && cached.expiresAt > now) return cached.keys;
  const res = await fetch(`${issuer}/.well-known/jwks.json`);
  if (!res.ok) throw new Error(`JWKS fetch failed with HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (keys.length === 0) throw new Error("JWKS response contained no keys");
  jwksCache.set(issuer, { keys, expiresAt: now + JWKS_TTL_MS });
  return keys;
}

// ---------------------------------------------------------------------------
// Entitlement resolution
// ---------------------------------------------------------------------------

function featureEntryMatches(entry: unknown): boolean {
  if (typeof entry === "string") return entry === PAID_FEATURE;
  if (entry && typeof entry === "object") {
    const slug = (entry as Record<string, unknown>).slug;
    if (typeof slug === "string") return slug === PAID_FEATURE;
  }
  return false;
}

/**
 * Clerk Billing surfaces the user's enabled features on the session token
 * (`features` claim) as an array of slugs or { slug } objects.
 */
function hasFeatureClaim(claims: Record<string, unknown>): boolean {
  const features = claims.features;
  if (Array.isArray(features)) return features.some(featureEntryMatches);
  return featureEntryMatches(features);
}

function emailFromClaims(claims: Record<string, unknown>): string | null {
  if (typeof claims.email === "string") return claims.email;
  if (typeof claims.email_address === "string") return claims.email_address;
  return null;
}

/**
 * Resolve legacy_access via the Clerk Backend API user object. Fails closed
 * ({ legacyAccess: false }) when CLERK_SECRET_KEY is missing or the lookup
 * errors. The user's primary email is returned when available.
 */
async function fetchLegacyAccess(
  userId: string
): Promise<{ legacyAccess: boolean; email: string | null }> {
  const secret = readEnv("CLERK_SECRET_KEY");
  if (!secret) {
    console.error(
      "[clerkAuth] CLERK_SECRET_KEY is not set; cannot resolve publicMetadata.legacy_access — denying (fail closed)."
    );
    return { legacyAccess: false, email: null };
  }
  try {
    const res = await fetch(`${CLERK_API_BASE}/users/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) {
      console.error(`[clerkAuth] Clerk user lookup failed: HTTP ${res.status} — denying (fail closed).`);
      return { legacyAccess: false, email: null };
    }
    const user = (await res.json()) as {
      primary_email_address_id?: string | null;
      email_addresses?: Array<{ id?: string; email_address?: string }>;
      public_metadata?: { legacy_access?: unknown } | null;
    };
    const legacyAccess = user?.public_metadata?.legacy_access === true;
    const primaryEmail =
      user?.email_addresses?.find((e) => e.id === user.primary_email_address_id)
        ?.email_address ?? null;
    return { legacyAccess, email: primaryEmail };
  } catch (err) {
    console.error("[clerkAuth] Clerk user lookup error:", err);
    return { legacyAccess: false, email: null };
  }
}

/**
 * Verify the Clerk session token and resolve the entitlement state.
 * Returns null when the request is unauthenticated (no token, malformed,
 * wrong algorithm, bad/expired signature, issuer mismatch, or no issuer
 * configured). Never throws.
 */
export async function verifyClerkToken(req: Request): Promise<ClerkIdentity | null> {
  const token = extractBearerToken(req);
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [rawHeader, rawPayload, rawSignature] = parts;

  const header = decodeJwtPart<Record<string, unknown>>(rawHeader);
  const claims = decodeJwtPart<Record<string, unknown>>(rawPayload);
  if (!header || !claims || typeof claims.sub !== "string") return null;
  if (header.alg !== "RS256") {
    console.error("[clerkAuth] Unexpected JWT alg:", header.alg);
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === "number" && claims.exp < nowSec - CLOCK_SKEW_SEC) return null;
  if (typeof claims.nbf === "number" && claims.nbf > nowSec + CLOCK_SKEW_SEC) return null;

  const issuer = getClerkIssuer();
  if (!issuer) {
    console.error(
      "[clerkAuth] No Clerk issuer configured (set CLERK_ISSUER_URL or CLERK_PUBLISHABLE_KEY) — denying."
    );
    return null;
  }
  if (
    typeof claims.iss === "string" &&
    claims.iss.replace(/\/+$/, "") !== issuer
  ) {
    console.error("[clerkAuth] JWT issuer mismatch:", claims.iss);
    return null;
  }

  const featureFullAccess = hasFeatureClaim(claims);

  let signatureValid: boolean;
  try {
    const keys = await fetchJwks(issuer);
    const kid = typeof header.kid === "string" ? header.kid : null;
    const jwk = keys.find((k) => k.kid === kid) ?? (kid ? undefined : keys[0]);
    if (!jwk) {
      console.error("[clerkAuth] No JWKS key matched token kid:", kid);
      return null;
    }
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signingInput = new TextEncoder().encode(`${rawHeader}.${rawPayload}`);
    signatureValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      base64UrlDecode(rawSignature),
      signingInput
    );
  } catch (err) {
    console.error("[clerkAuth] JWT verification error:", err);
    return null;
  }
  if (!signatureValid) {
    console.error("[clerkAuth] JWT signature verification failed");
    return null;
  }

  const userId = claims.sub;
  const email = emailFromClaims(claims);

  // Billing feature claim is authoritative and avoids the Backend API call.
  if (featureFullAccess) {
    return { userId, email, legacyAccess: false, featureFullAccess: true };
  }

  const legacyResult = await fetchLegacyAccess(userId);
  return {
    userId,
    email: email ?? legacyResult.email,
    legacyAccess: legacyResult.legacyAccess,
    featureFullAccess: false,
  };
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

function jsonDenial(
  error: string,
  message: string,
  status: number,
  extra: Record<string, unknown> | undefined,
  corsHeaders?: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ error, message, ...(extra ?? {}) }),
    {
      status,
      headers: {
        ...(corsHeaders ?? {}),
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Entitlement gate for edge-function handlers.
 * Returns a rendered 401/403 Response when the request must be denied, or
 * null when the caller is authenticated AND entitled (safe to proceed).
 */
export async function requireEntitlement(
  req: Request,
  corsHeaders?: Record<string, string>
): Promise<Response | null> {
  const identity = await verifyClerkToken(req);
  if (!identity) {
    return jsonDenial(
      "AUTH_REQUIRED",
      "Authentication required. Sign in and try again.",
      401,
      undefined,
      corsHeaders
    );
  }
  if (!identity.legacyAccess && !identity.featureFullAccess) {
    return jsonDenial(
      "PAYMENT_REQUIRED",
      "SmartVideo AI purchase required.",
      403,
      { upgradeRequired: true },
      corsHeaders
    );
  }
  return null;
}
