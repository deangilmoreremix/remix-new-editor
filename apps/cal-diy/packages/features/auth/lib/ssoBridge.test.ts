// @vitest-environment node
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  SsoBridgeError,
  findOrCreateSsoUser,
  getSsoBridgeConfig,
  safeNextPath,
  ssoUsernameFor,
  verifySsoToken,
} from "./ssoBridge";

const ISSUER = "https://clerk.example.com";
const ORIGIN = "https://app.example.com";
const config = { jwksUrl: `${ISSUER}/.well-known/jwks.json`, issuer: ISSUER, allowedOrigins: [ORIGIN] };

let signKey: CryptoKey;
let otherKey: CryptoKey;
let getKey: ReturnType<typeof createLocalJWKSet>;

type Claims = Record<string, unknown>;
const mint = (claims: Claims = {}, opts: { key?: CryptoKey; iss?: string; exp?: string | number } = {}) =>
  new SignJWT({ azp: ORIGIN, email: "Ann@Example.com", name: "Ann Lee", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(opts.iss ?? ISSUER)
    .setSubject((claims.sub as string) ?? "user_2abcDEF123")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "60s")
    .sign(opts.key ?? signKey);

beforeAll(async () => {
  const a = await generateKeyPair("RS256");
  const b = await generateKeyPair("RS256");
  signKey = a.privateKey;
  otherKey = b.privateKey;
  getKey = createLocalJWKSet({ keys: [{ ...(await exportJWK(a.publicKey)), kid: "k1", alg: "RS256", use: "sig" }] });
});

describe("getSsoBridgeConfig", () => {
  const env = {
    SSO_BRIDGE_JWKS_URL: config.jwksUrl,
    SSO_BRIDGE_ISSUER: ISSUER,
    SSO_BRIDGE_ALLOWED_ORIGINS: `${ORIGIN}, https://www.example.com`,
  };
  it("is off unless everything is set", () => {
    expect(getSsoBridgeConfig({})).toBeNull();
    expect(getSsoBridgeConfig({ ...env, SSO_BRIDGE_ISSUER: "" })).toBeNull();
    expect(getSsoBridgeConfig({ ...env, SSO_BRIDGE_ALLOWED_ORIGINS: " , " })).toBeNull();
  });
  it("only reads keys over https (http only for localhost)", () => {
    expect(getSsoBridgeConfig({ ...env, SSO_BRIDGE_JWKS_URL: "http://evil.example.com/jwks" })).toBeNull();
    expect(getSsoBridgeConfig({ ...env, SSO_BRIDGE_JWKS_URL: "http://localhost:4000/jwks" })).not.toBeNull();
  });
  it("splits the allowed origins", () => {
    expect(getSsoBridgeConfig(env)?.allowedOrigins).toEqual([ORIGIN, "https://www.example.com"]);
  });
});

describe("verifySsoToken", () => {
  it("accepts a valid token and normalises the identity", async () => {
    await expect(verifySsoToken(await mint(), config, getKey)).resolves.toEqual({
      sub: "user_2abcDEF123",
      email: "ann@example.com",
      name: "Ann Lee",
    });
  });
  it("falls back to the email's local part when there is no name", async () => {
    const id = await verifySsoToken(await mint({ name: undefined }), config, getKey);
    expect(id.name).toBe("ann");
  });
  it("refuses a token signed by a different key", async () => {
    await expect(verifySsoToken(await mint({}, { key: otherKey }), config, getKey)).rejects.toThrow(
      SsoBridgeError.InvalidToken
    );
  });
  it("refuses an expired token", async () => {
    await expect(verifySsoToken(await mint({}, { exp: Math.floor(Date.now() / 1000) - 120 }), config, getKey)).rejects.toThrow(
      SsoBridgeError.InvalidToken
    );
  });
  it("refuses the wrong issuer", async () => {
    await expect(verifySsoToken(await mint({}, { iss: "https://evil.example.com" }), config, getKey)).rejects.toThrow(
      SsoBridgeError.InvalidToken
    );
  });
  it("refuses a token minted for a different origin (azp)", async () => {
    await expect(verifySsoToken(await mint({ azp: "https://other.example.com" }), config, getKey)).rejects.toThrow(
      SsoBridgeError.InvalidToken
    );
    await expect(verifySsoToken(await mint({ azp: undefined }), config, getKey)).rejects.toThrow(
      SsoBridgeError.InvalidToken
    );
  });
  it("refuses a token without a usable email", async () => {
    await expect(verifySsoToken(await mint({ email: undefined }), config, getKey)).rejects.toThrow(
      SsoBridgeError.InvalidToken
    );
    await expect(verifySsoToken(await mint({ email: "not-an-email" }), config, getKey)).rejects.toThrow(
      SsoBridgeError.InvalidToken
    );
  });
  it("refuses an unsigned (alg=none) token and junk", async () => {
    const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(
      JSON.stringify({ iss: ISSUER, azp: ORIGIN, sub: "user_1", email: "a@b.co" })
    ).toString("base64url")}.`;
    await expect(verifySsoToken(none, config, getKey)).rejects.toThrow(SsoBridgeError.InvalidToken);
    await expect(verifySsoToken("", config, getKey)).rejects.toThrow(SsoBridgeError.InvalidToken);
    await expect(verifySsoToken("x".repeat(9000), config, getKey)).rejects.toThrow(SsoBridgeError.InvalidToken);
  });
});

describe("ssoUsernameFor", () => {
  it("is deterministic and slug-safe", () => {
    expect(ssoUsernameFor("user_2abcDEF123")).toBe("u-2abcdef123");
    expect(ssoUsernameFor("user_2abcDEF123")).toBe(ssoUsernameFor("user_2abcDEF123"));
    expect(ssoUsernameFor("user_2ab-cd_EF!@#")).toBe("u-2abcdef");
  });
  it("caps the length and refuses an empty id", () => {
    expect(ssoUsernameFor(`user_${"a".repeat(60)}`)).toHaveLength(2 + 20);
    expect(() => ssoUsernameFor("user_!!!")).toThrow(SsoBridgeError.InvalidToken);
  });
});

describe("safeNextPath", () => {
  it("keeps paths inside Cal.diy", () => {
    expect(safeNextPath("/availability")).toBe("/availability");
    expect(safeNextPath("/event-types?x=1#y")).toBe("/event-types?x=1#y");
  });
  it("replaces anything that could leave the site", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "evil", "", null, undefined, 5]) {
      expect(safeNextPath(bad)).toBe("/event-types");
    }
  });
});

describe("findOrCreateSsoUser", () => {
  const identity = { sub: "user_2abcDEF123", email: "ann@example.com", name: "Ann Lee" };
  const makePrisma = (over: { bySub?: unknown; emailTaken?: unknown; usernameTaken?: unknown } = {}) => {
    const findFirst = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (where.metadata) return over.bySub ?? null;
      if (where.email) return over.emailTaken ?? null;
      if (where.username) return over.usernameTaken ?? null;
      return null;
    });
    const eventTypeCreate = vi.fn(async () => ({ id: 1 }));
    return { prisma: { user: { findFirst }, eventType: { create: eventTypeCreate } } as never, findFirst, eventTypeCreate };
  };
  const repo = () => ({ create: vi.fn(async (d: { email: string }) => ({ id: 7, email: d.email })) });

  it("returns the existing account matched by the host-app id, creating nothing", async () => {
    const { prisma, eventTypeCreate } = makePrisma({ bySub: { id: 3, email: "old@example.com", locked: false, role: "USER" } });
    const r = repo();
    await expect(findOrCreateSsoUser(identity, prisma, r)).resolves.toEqual({ id: 3, email: "old@example.com" });
    expect(r.create).not.toHaveBeenCalled();
    expect(eventTypeCreate).not.toHaveBeenCalled();
  });
  it("refuses locked accounts and non-USER roles", async () => {
    await expect(
      findOrCreateSsoUser(identity, makePrisma({ bySub: { id: 3, email: "a@b.co", locked: true, role: "USER" } }).prisma, repo())
    ).rejects.toThrow(SsoBridgeError.AccountLocked);
    await expect(
      findOrCreateSsoUser(identity, makePrisma({ bySub: { id: 3, email: "a@b.co", locked: false, role: "ADMIN" } }).prisma, repo())
    ).rejects.toThrow(SsoBridgeError.NotAllowed);
  });
  it("never takes over an existing account that has the same email", async () => {
    const r = repo();
    await expect(findOrCreateSsoUser(identity, makePrisma({ emailTaken: { id: 1 } }).prisma, r)).rejects.toThrow(
      SsoBridgeError.EmailInUse
    );
    expect(r.create).not.toHaveBeenCalled();
  });
  it("refuses a taken username", async () => {
    await expect(findOrCreateSsoUser(identity, makePrisma({ usernameTaken: { id: 1 } }).prisma, repo())).rejects.toThrow(
      SsoBridgeError.UsernameTaken
    );
  });
  it("creates a password-less account and a ready 30min event type for a new person", async () => {
    const { prisma, eventTypeCreate } = makePrisma();
    const r = repo();
    await expect(findOrCreateSsoUser(identity, prisma, r)).resolves.toEqual({ id: 7, email: "ann@example.com" });
    const arg = r.create.mock.calls[0][0] as Record<string, unknown>;
    expect(arg).toMatchObject({
      username: "u-2abcdef123",
      email: "ann@example.com",
      name: "Ann Lee",
      completedOnboarding: true,
      metadata: { ssoSub: "user_2abcDEF123" },
      locked: false,
    });
    expect(arg.hashedPassword).toBeUndefined();
    expect(eventTypeCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ slug: "30min", length: 30, userId: 7 }),
    });
  });
});
