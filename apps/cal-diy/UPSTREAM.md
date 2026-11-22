# Upstream source

Unmodified copy of https://github.com/calcom/cal.diy (MIT) at commit ae027bb
("chore: remove unused support chat env vars from .env.example (#30478)").
Not part of the root npm workspaces: it has its own Yarn 4 install and Postgres database.
See README.md here for setup. Do not edit files in this folder; update by re-copying from upstream.

## Local changes to upstream files
- `apps/web/calendso.yaml` lines 349-350: the sample Google OAuth access/refresh token values in the API example
  were replaced with `REDACTED_SAMPLE_TOKEN` because GitHub push protection blocks them. Docs only; no code impact.

## SSO bridge (local patch; deliberate change to upstream auth)
Lets the host app (SmartVideo, signed in with Clerk) open Cal.diy with no second login. Re-apply on an upstream update with
`git apply SSO_BRIDGE.patch` from this folder's contents (paths are relative to `apps/cal-diy`). Then re-run
`TZ=UTC yarn vitest run packages/features/auth/lib/ssoBridge.test.ts`.

Files: new `packages/features/auth/lib/ssoBridge.ts`, `ssoNextPath.ts`, `ssoBridge.test.ts`,
`apps/web/modules/auth/sso-view.tsx`, `apps/web/app/(use-page-wrapper)/auth/sso/page.tsx`;
edited `packages/features/auth/lib/next-auth-options.ts` (one import, one block registering the `sso-bridge` provider) and `turbo.json`
(the three `SSO_BRIDGE_*` names added to `globalEnv`: Turbo strips every variable that is not on that list, so without it the
bridge silently stays off in production). For production builds also add `ENV NEXT_PUBLIC_DISABLE_SIGNUP=true` to the Dockerfile's
builder stage to close public sign-up (applied by the VM build script, not part of the patch).

How it works: the host app opens `<cal>/auth/sso#token=<Clerk session token>&next=/availability`. Cal.diy verifies the token
against the host's public keys (RS256, issuer, expiry, `azp` allow-list), finds the account by the host user id stored in
`User.metadata.ssoSub` (never by email alone), or creates it (password-less, default availability, a `30min` event type).
Username is deterministic: `u-` + the Clerk id without `user_`, lowercased, max 20 chars.

It is OFF unless all three are set: `SSO_BRIDGE_JWKS_URL` (https), `SSO_BRIDGE_ISSUER`, `SSO_BRIDGE_ALLOWED_ORIGINS` (comma list).
No schema change, no new dependency (`jose` is already used by apps/web).
