# Upstream dashboard (vendored)

This directory is the `web/` app of https://github.com/warmbly/warmbly, vendored unmodified except for the patches below.
Licence: Apache License 2.0 (`LICENSE`). Source commit: `c2e36cc`.

It is built under `/smartwarmupai-app/` and embedded in the SmartWarmupAI studio. The product is rebranded **at build time** by
`../smartwarmupai-brand/rebrand-plugin.mjs`, so these sources stay exactly as upstream wrote them and future upstream syncs stay simple.

Check at any time that nothing else has drifted:

```bash
git clone https://github.com/warmbly/warmbly /tmp/upstream && git -C /tmp/upstream checkout c2e36cc
npm run verify:upstream -- /tmp/upstream
```

## Local changes (the only differences from upstream)

| File | Change |
|---|---|
| `vite.config.ts` | `base` from `VITE_BASE`; registers the rebrand plugin (off with `VITE_BRAND=off`) |
| `src/router.tsx` | `basepath` from Vite's `BASE_URL` |
| `src/lib/information.ts` | `DEMO` flag |
| `src/lib/api/client/Client.ts` | axios uses the fetch adapter in demo mode |
| `src/main.tsx` | `installDemo()` before the first render in demo mode |
| `src/lib/demo/*` | added: recorded-data server, fake Phoenix socket, installer, `fixtures.json`, tests |
| `src/lib/hostSession.ts`, `src/lib/api/client/auth/exchangeClerk.ts` | added: one login. Reads the host app's Clerk session (`window.top.Clerk`, same-origin iframe) and exchanges it at `POST /auth/clerk` (see `../warmbly-server/UPSTREAM.md`) for a Warmbly session; sign-out follows the host. Tests in `hostSession.test.ts` |
| `src/lib/information.ts` | `HOST_SESSION` flag (`VITE_HOST_SESSION=1`, off in demo) |
| `src/main.tsx` | `bootHostSession()` before the first render when `HOST_SESSION` |
| `src/router.tsx` | with `HOST_SESSION`, every `/auth/*` route goes to the host sign-in |
| `src/lib/api/client/auth/refreshToken.ts` | with `HOST_SESSION`, refreshing re-reads the host token |
| `src/lib/api/hooks/auth/useLogout.ts` | with `HOST_SESSION`, logout also signs out of the host |
| `UPSTREAM.md` | added: this file |

## Demo mode (no backend)

`VITE_DEMO=1` answers every API call from `src/lib/demo/fixtures.json`, responses recorded from a seeded upstream instance, and
applies create, update, delete and start/pause in memory. Two entries are hand-built from upstream's TypeScript models:
`GET /v1/subscription/balance` and `GET /v1/subscription/credits/usage`. The rebrand plugin presents the demo workspace as a
hosted, billing-enabled service under the new name.

To use a real upstream-compatible backend instead, build without `VITE_DEMO` and set `WARMBLY_API_URL` in the runtime `config.js`.

## What the rebrand changes (and does not)

Only the capitalised product name in user-facing text, links to the original site and docs, the logo mark, icons and the web
manifest. Lowercase identifiers (storage keys, `data-warmbly-*` attributes, API paths and headers, `.warmbly.zip` exports) are never
touched, because a real backend depends on them. See `../smartwarmupai-brand/README.md`.

Warmbly is a trademark of its owners; the Apache licence does not grant trademark rights, which is why the product is rebranded.

## One login (real backend)

Build with `VITE_HOST_SESSION=1` (and no `VITE_DEMO`) and the dashboard has no sign-in of its own: it takes the host app's Clerk
session, exchanged once at startup and again only when the dashboard needs a fresh token. The backend side is `POST /auth/clerk`
(set `CLERK_ISSUER`, `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES` there). The shipped demo build is unchanged.
