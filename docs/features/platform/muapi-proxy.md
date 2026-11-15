---
name: MuAPI Proxy (edge function)
area: platform
status: live
added: 2026-03-14
pr: TBD
route: Supabase edge function `muapi-proxy`
code:
  - supabase/functions/muapi-proxy/index.ts
---

## What it does
Forwards generation requests to api.muapi.ai on behalf of the browser. Every request must carry the caller's own MuAPI key; there is no server-side fallback key. CORS is limited to an allow-list (ALLOWED_ORIGINS, with first-party defaults), and responses carry security headers.

## Where in the app
No UI; used by every generation studio.

## Depends on
Env: ALLOWED_ORIGINS, SUPABASE_ENV, ALLOW_UNAUTHENTICATED. See `docs/MUAPI_INTEGRATION_GUIDE.md`.

## How to test
Open the route above and run one generation or action end to end. TBD: add the e2e spec path if one exists.
