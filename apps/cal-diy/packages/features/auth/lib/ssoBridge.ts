/**
 * SSO BRIDGE (local patch on top of upstream cal.diy; see apps/cal-diy/UPSTREAM.md and SSO_BRIDGE.patch).
 *
 * Lets a host app that already signs its users in (SmartVideo, with Clerk) open Cal.diy with no second login.
 * The host app sends the user's own Clerk session token; Cal.diy verifies it against the host's PUBLIC keys (JWKS),
 * so there is no shared secret to copy between systems. The first time a person arrives, a Cal.diy account is created
 * for them (own availability, own event types, own booking link). Nobody ever types a password.
 *
 * Off unless all of SSO_BRIDGE_JWKS_URL, SSO_BRIDGE_ISSUER and SSO_BRIDGE_ALLOWED_ORIGINS are set.
 */
import type { PrismaClient } from "@calcom/prisma";
import { CreationSource, IdentityProvider } from "@calcom/prisma/enums";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JWTVerifyGetKey } from "jose";

export const SSO_BRIDGE_PROVIDER_ID = "sso-bridge";

export type SsoBridgeConfig = {
  jwksUrl: string;
  issuer: string;
  /** Allowed `azp` values: the origins of the host app that may mint tokens (Clerk puts the page origin in `azp`). */
  allowedOrigins: string[];
};

export type SsoIdentity = { sub: string; email: string; name: string };

/** Every failure surfaces as one of these; the login page shows a generic message and the details stay in the log. */
export const SsoBridgeError = {
  NotConfigured: "sso-not-configured",
  InvalidToken: "sso-invalid-token",
  EmailInUse: "sso-email-in-use",
  UsernameTaken: "sso-username-taken",
  AccountLocked: "sso-account-locked",
  NotAllowed: "sso-not-allowed",
} as const;

export function getSsoBridgeConfig(env: Record<string, string | undefined> = process.env): SsoBridgeConfig | null {
  const jwksUrl = env.SSO_BRIDGE_JWKS_URL?.trim();
  const issuer = env.SSO_BRIDGE_ISSUER?.trim();
  const allowedOrigins = (env.SSO_BRIDGE_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!jwksUrl || !issuer || allowedOrigins.length === 0) return null;
  // Keys are fetched over https only (http only for a local test server).
  if (!/^https:\/\//i.test(jwksUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/i.test(jwksUrl)) return null;
  return { jwksUrl, issuer, allowedOrigins };
}

const keySets = new Map<string, JWTVerifyGetKey>();
function remoteKeys(url: string): JWTVerifyGetKey {
  let keys = keySets.get(url);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(url), { cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 });
    keySets.set(url, keys);
  }
  return keys;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Verifies a host-app session token and returns who it is for. Checks: RS256 signature against the host's JWKS,
 * issuer, expiry / not-before (Clerk session tokens live about a minute), that `azp` is one of our allowed origins
 * (so a token minted for some other app is refused), and that it carries a subject and an email.
 */
export async function verifySsoToken(
  token: string,
  config: SsoBridgeConfig,
  getKey: JWTVerifyGetKey = remoteKeys(config.jwksUrl)
): Promise<SsoIdentity> {
  if (typeof token !== "string" || token.length < 20 || token.length > 8000) throw new Error(SsoBridgeError.InvalidToken);
  let payload: Record<string, unknown>;
  try {
    const res = await jwtVerify(token, getKey, {
      issuer: config.issuer,
      algorithms: ["RS256"],
      clockTolerance: 5,
    });
    payload = res.payload as Record<string, unknown>;
  } catch {
    throw new Error(SsoBridgeError.InvalidToken);
  }
  const azp = clean(payload.azp, 300);
  if (!azp || !config.allowedOrigins.includes(azp)) throw new Error(SsoBridgeError.InvalidToken);
  const sub = clean(payload.sub, 100);
  const email = clean(payload.email ?? payload.primary_email_address, 320).toLowerCase();
  if (!sub || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(SsoBridgeError.InvalidToken);
  const name = clean(payload.name ?? payload.full_name, 100) || email.split("@")[0];
  return { sub, email, name };
}

/**
 * The Cal.diy username (and so the booking-link prefix) for a host-app user id. Deterministic, so the host app can
 * build a person's booking link (`<username>/30min`) without asking Cal.diy. Clerk ids look like `user_2abc...`.
 */
export function ssoUsernameFor(sub: string): string {
  const core = sub.replace(/^user_/i, "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  if (!core) throw new Error(SsoBridgeError.InvalidToken);
  return `u-${core}`;
}

type UserRepo = {
  create: (data: {
    username: string;
    email: string;
    organizationId: number | null;
    creationSource: CreationSource;
    identityProvider: IdentityProvider;
    locked: boolean;
    [k: string]: unknown;
  }) => Promise<{ id: number; email: string }>;
};

/**
 * Finds the Cal.diy user for this host-app user, creating one the first time. People are matched by the host-app
 * user id stored on their Cal.diy account, never by email alone, so a token can never take over an account that
 * already existed (for example the admin). A matching email on an account we did not create is refused.
 */
export async function findOrCreateSsoUser(
  identity: SsoIdentity,
  prisma: PrismaClient,
  userRepo: UserRepo
): Promise<{ id: number; email: string }> {
  const bySub = await prisma.user.findFirst({
    where: { metadata: { path: ["ssoSub"], equals: identity.sub } },
    select: { id: true, email: true, locked: true, role: true },
  });
  if (bySub) {
    if (bySub.locked) throw new Error(SsoBridgeError.AccountLocked);
    if (bySub.role !== "USER") throw new Error(SsoBridgeError.NotAllowed);
    return { id: bySub.id, email: bySub.email };
  }

  const username = ssoUsernameFor(identity.sub);
  const [emailTaken, usernameTaken] = await Promise.all([
    prisma.user.findFirst({ where: { email: identity.email }, select: { id: true } }),
    prisma.user.findFirst({ where: { username }, select: { id: true } }),
  ]);
  if (emailTaken) throw new Error(SsoBridgeError.EmailInUse);
  if (usernameTaken) throw new Error(SsoBridgeError.UsernameTaken);

  // No password is set: the account can only be entered through the bridge. Default weekly availability is created by
  // the repository, as for any new account.
  const user = await userRepo.create({
    username,
    email: identity.email,
    name: identity.name,
    emailVerified: new Date(),
    completedOnboarding: true,
    metadata: { ssoSub: identity.sub },
    organizationId: null,
    creationSource: CreationSource.WEBAPP,
    identityProvider: IdentityProvider.CAL,
    locked: false,
  });

  // A ready-to-use booking link from the first visit: `<username>/30min`.
  await prisma.eventType.create({
    data: {
      title: "30 min meeting",
      slug: "30min",
      length: 30,
      userId: user.id,
      users: { connect: [{ id: user.id }] },
    },
  });
  return { id: user.id, email: user.email };
}

export { safeNextPath } from "./ssoNextPath";
