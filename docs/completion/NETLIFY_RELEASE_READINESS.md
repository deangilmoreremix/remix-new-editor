# Netlify Release Readiness — `integration/personalization-complete`

- **Worktree:** `/Users/shasheemoore/Downloads/remix-integration-worktree` @ `4c423e478`
- **Assessed:** 2026-10-12 (deployment-check only; no prod deploy, no DNS, no merge)
- **Scope:** build settings, real build reproduction, env-var inventory, site linkage, function runtime sanity

---

## 1. VERDICT: READY-WITH-WARNINGS

The branch builds cleanly exactly the way Netlify will build it, the client
bundle contains zero server-only symbols, and the new function is
convention-compatible with its siblings. Deploy is **not blocked by code**.
It is gated by operational steps a human must perform (env vars in Netlify,
site link) and by one onboarding bug in `.env.example` plus one pre-existing
security-pattern finding (`VITE_MUAPI_KEY`).

---

## 2. Build settings audit (evidence from `netlify.toml`, 108 lines)

| Setting | Value | Line | Verdict |
|---|---|---|---|
| `build.command` | `npm install --include=optional && npm run build` | 3 | CORRECT for this branch |
| `build.publish` | `dist` | 4 | CORRECT |
| `NODE_VERSION` | `22` (in `[build.environment]`) | 7 | Matches `engines.node` (see below) |
| `SECRETS_SCAN_OMIT_KEYS` | `CLERK_SECRET_KEY,MAIGRET_WORKER_SECRET,MAIGRET_WORKER_URL,PERSONALIZATION_DISCOVERY_SECRET` | 8 | Covers the new secret; 2 additions recommended (§5) |
| CSP `frame-ancestors` | `'self' https://smartvid.app https://www.smartvid.app https://ai-vfx.smartvid.app https://teal-puffpuff-ce9767.netlify.app` (inside `Content-Security-Policy` for `/*`) | 32–41 | Intact |
| `/openthorn/*` redirect | → `/openthorn/index.html`, `status = 200`, `force = false` | 91–95 | Correct (real files still served) |
| SPA fallback | `/*` → `/index.html`, `status = 200`, `force = false` | 104–108 | Correct |
| `[functions]` block | — | — | **Absent — and correctly so.** Netlify auto-detects `netlify/functions`; no override, no `exclude` pattern anywhere in the file. `netlify/functions/personalization-discovery.js` WILL be picked up as `/.netlify/functions/personalization-discovery`. |

**Node version cross-check:** `package.json:154-156` declares
`"engines": { "node": ">=22.0.0" }`; there is **no `packageManager` field**.
`NODE_VERSION = "22"` satisfies `>=22.0.0`. No mismatch.

**`dist/` contents:** `package.json:14` `build` script =
`npm run build:openthorn && rm -rf dist && vite build`, and `build:openthorn`
(line 35) runs the openthorn vite build then copies
`apps/openthorn/dist` → `public/openthorn`, which the main vite build emits
as `dist/openthorn`. Verified below.

---

## 3. Real build results (run in the worktree, same order as Netlify)

| Step | Command | Exit code | Duration | Notes |
|---|---|---|---|---|
| 1 | `npm run build:openthorn` | **0** | ~16.7s | last line: `✓ built in 11.93s` (chunk-size warnings only) |
| 2 | `npx vite build` | **0** | **3m 13.9s** | last line: `✓ built in 3m 9s` (chunk-size warnings only) |

**Artifacts:**

```
dist/index.html           2920 B
dist/openthorn/index.html 3078 B   ← confirms the build:openthorn → public/openthorn → dist/openthorn chain
dist/assets/              (populated)
find dist -name "*.js" | wc -l  →  306
```

**Client-bundle leak scan (`dist/assets/*.js`) — ALL CLEAN:**

| Probe | Result |
|---|---|
| `grep -l "node:dns"` | CLEAN — not present |
| `grep -l "node:crypto"` | CLEAN — not present |
| `grep -l "discoverAssets"` | CLEAN — not present |
| `grep -l "puppeteer"` | CLEAN — not present |

Expected and confirmed present: the plain fetch URL string
`/.netlify/functions/personalization-discovery` in
`dist/assets/Personalizer-smiDDvqP.js` (client-side call site —
`src/components/personalize/PersonalizationHubPanel.js:65`). That is correct
behavior, not a leak.

---

## 4. Environment-variable inventory

Checked against `src/` (`import.meta.env.VITE_*`) and `netlify/functions/`
(`process.env.*`). "SET" below = present in this check environment's
`process.env` (names only; no values read).

| var | used by | client/server | required? | in `netlify.toml [build.environment]`? | in `.env.example`? | SET locally? |
|---|---|---|---|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | src (auth, 4 sites) | client | YES | n/a (build-time var; set in Netlify UI) | YES (line 147) | NOT SET |
| `VITE_SUPABASE_URL` | src (6 sites) | client | YES | n/a | YES (line 142) | NOT SET |
| `VITE_SUPABASE_ANON_KEY` | src (3 sites) | client | YES | n/a | YES (line 143) | NOT SET |
| `VITE_MUAPI_URL` | src (2 sites) | client | YES | n/a | YES (line 161) | NOT SET |
| `VITE_MUAPI_KEY` | `src/services/whisper-client.js:15` | client | optional (default key) | n/a | YES (line 160) | NOT SET | **see CRITICAL-1** |
| `VITE_PEXELS_API_KEY` | `src/lib/editor/pexelsIntegration.js:41` | client | optional | n/a | commented only (line 190) | NOT SET | **see WARNING** |
| `OPENAI_API_KEY` | functions (13 sites: personalizer-api, timeline-*) | server | YES (personalizer AI paths) | no | YES (line 216) | NOT SET |
| `SUPABASE_URL` | functions (4 sites incl. personalization-discovery:85) | server | YES | no | YES (line 227) | NOT SET |
| `SUPABASE_SERVICE_ROLE_KEY` | functions (4 sites incl. personalization-discovery:86, personalizer-api:5) | server | **YES** | no | **NO — `.env.example` has the WRONG name `SUPABASE_SERVICE_KEY` (line 229)** | NOT SET |
| `PERSONALIZATION_DISCOVERY_SECRET` | `personalization-discovery.js:282` | server | optional (server-to-server alt auth; browser path uses Supabase token) | no | **NO — missing entirely** | NOT SET |
| `MUAPI_API_KEY` | `netlify/functions/cinegenProviders.js:11` (throws if absent) | server | YES (MuAPI timeline path) | no | comment only (line 157), no entry | NOT SET |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `clerk-webhook.js` | server | YES (webhook) | no | YES (line 154) | NOT SET |
| `MAIGRET_WORKER_URL` / `MAIGRET_WORKER_SECRET` | personalizer-api | server | optional (maigret path) | no | YES (lines 238–239) | NOT SET |
| `ALLOWED_ORIGINS` | 4 functions (CORS default `*`) | server | optional | no | NO | NOT SET |
| `GEMINI_API_KEY` | functions (4 sites) | server | optional | no | commented alias only (line 46) | NOT SET |
| `PIXABAY_API_KEY` | pixabay-search | server | optional | no | YES (line 118) | NOT SET |

**`.env.example` gaps (onboarding bugs):**
1. `SUPABASE_SERVICE_ROLE_KEY` — absent; the file documents `SUPABASE_SERVICE_KEY` instead. A human following `.env.example` will set the wrong
   name and the personalizer + discovery functions will silently lose their
   Supabase service client (auth + durable job rows both fail closed).
2. `PERSONALIZATION_DISCOVERY_SECRET` — absent (the comment on line 237-239
   covers only the maigret pair).
3. `MUAPI_API_KEY` — mentioned only in prose (line 157), no settable entry.
4. `ALLOWED_ORIGINS` — absent (optional; defaults to `*`).

**Local environment:** every var above is NOT set in `process.env` here, and
there is no `.env` / `.env.local` / `.env.production` in the worktree. Live
endpoint testing is therefore impossible from this machine (expected for a
release-check sandbox; the build itself does not need these).

**`SECRETS_SCAN_OMIT_KEYS` audit (line 8):** covers
`CLERK_SECRET_KEY, MAIGRET_WORKER_SECRET, MAIGRET_WORKER_URL,
PERSONALIZATION_DISCOVERY_SECRET` — the discovery agent's new secret IS
covered. Gaps: `SUPABASE_SERVICE_ROLE_KEY` and
`CLERK_WEBHOOK_SIGNING_SECRET` are server-only secrets not in the omit list.
Netlify's scanner trips on secrets appearing in build output; recommend adding
both to the list as defense in depth.

---

## 5. CRITICAL findings

- **CRITICAL-1 — `VITE_MUAPI_KEY` is a browser-exposed API key.**
  `src/services/whisper-client.js:15` reads `import.meta.env.VITE_MUAPI_KEY`
  as a fallback key, which Vite inlines into the client bundle. Any value set
  in Netlify for this var is world-readable in `dist/assets/*.js`. The
  `.env.example` design intends users to supply their own key (stored in
  browser localStorage), so the VITE_ default should be left unset in
  production; if a build-time default is truly required, it must be a
  low-privilege proxy key, not a personal MuAPI key.
- **WARNING — `VITE_PEXELS_API_KEY`** follows the same browser-exposure
  pattern (`src/lib/editor/pexelsIntegration.js:41`); keep unset in production
  and rely on the server-side proxy.
- **HIGH — `.env.example` documents `SUPABASE_SERVICE_KEY`, but every
  function reads `SUPABASE_SERVICE_ROLE_KEY`.** Following the example file
  produces a silently broken auth/durability layer in
  `personalization-discovery` and `personalizer-api`.
- **Build:** NOT a blocker. Both steps exit 0; client bundle CLEAN of
  `node:dns`, `node:crypto`, `discoverAssets`, `puppeteer`.
- No `VITE_`-prefixed secret beyond the two keys above was found; the
  personalization discovery path uses only server-side vars.

---

## 6. Function runtime sanity (static, no deploy)

- **Export/signature:** `personalization-discovery.js:461` exports
  `export async function handler(event)` — identical shape to
  `personalizer-api.js:345` (`handler(event, context)`) and
  `cinegen.js:86` (`handler(event)`). It additionally has
  `export default handler` (line 502), harmless for Netlify's esbuild
  bundler. Response style matches siblings: `{ statusCode, headers, body:
  JSON.stringify(...) }` with CORS headers.
- **Shared-code import:** `personalization-discovery.js:111` dynamically
  imports `'../../src/components/personalize/discovery/index.js'` (plus
  `urlSafety.js` at line 123) — repo-root-relative, the same
  `../../src/...` convention `intelligence-api.js:520` documents having used
  for `../../src/lib/contactStore.js`. Netlify Functions bundle from the
  repo root, so this resolves. The dynamic `import()` is also what keeps the
  Node-only engine out of the client bundle (verified CLEAN in §3).
- **Detection:** no `[functions]` block and no `exclude` pattern exist in
  `netlify.toml`; `netlify/functions/` auto-detection will pick up the new
  file. Confirmed sibling set: cinegen, clerk-webhook, intelligence-api,
  personalizer-api, pixabay-search, providers/, timeline-image-generate,
  timeline-script + the new personalization-discovery.
- **Node builtins:** the engine uses `node:crypto`, `node:dns`, `node:url`
  (lazy-loaded `node:dns` in `urlSafety.js:60`). All are supported on the AWS
  Lambda `nodejs` runtime used by Netlify Functions v2. No runtime override is
  specified in `netlify.toml`; Lambda's default Node runtime satisfies them.

---

## 7. Site linkage / deploy context — NOT POSSIBLE (no token)

- `npx netlify --version` → `netlify-cli/27.8.0` (available);
  `which netlify` → global install at
  `/Users/shasheemoore/.nvm/versions/node/v24.16.0/bin/netlify`.
- `NETLIFY_AUTH_TOKEN` — NOT set. `NETLIFY_SITE_ID` — NOT set.
- No `.netlify` link directory in the worktree;
  `npx netlify status` → *"Error: You don't appear to be in a folder that is
  linked to a project."*
- **No deploy preview was produced and none was fabricated.** Production
  deploy was never attempted.

## 8. Smoke-test results

None — no preview deploy exists (see §7). Once a human links the site and
creates a preview, the expected results are:

| URL | Expected |
|---|---|
| `/` | 200 |
| `/personalizer` | 200 (SPA fallback) |
| `/.netlify/functions/personalization-discovery` (no auth) | 401 (fail-closed: "Missing or invalid authorization header") |

---

## 9. Exact manual steps required before the first deploy

1. **Log in and link the site** (from the worktree or a clone of this branch):
   `netlify login && netlify link` — or set `NETLIFY_AUTH_TOKEN` +
   `NETLIFY_SITE_ID` in the environment.
2. **Set build-time (client) env vars in Netlify** (dashboard → Site
   configuration → Environment variables): `VITE_CLERK_PUBLISHABLE_KEY`,
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MUAPI_URL`. Leave
   `VITE_MUAPI_KEY` and `VITE_PEXELS_API_KEY` **unset** in production.
3. **Set server env vars** for functions: `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
   `CLERK_WEBHOOK_SIGNING_SECRET`, `MUAPI_API_KEY`, `PIXABAY_API_KEY`, and
   `PERSONALIZATION_DISCOVERY_SECRET` (only if a server-to-server caller
   needs it).
4. **Fix `.env.example`** (follow-up commit recommended): add
   `SUPABASE_SERVICE_ROLE_KEY=`, add `PERSONALIZATION_DISCOVERY_SECRET=`,
   add `MUAPI_API_KEY=`, and fix the wrong `SUPABASE_SERVICE_KEY` entry.
5. **Consider extending `SECRETS_SCAN_OMIT_KEYS`** (netlify.toml line 8) with
   `SUPABASE_SERVICE_ROLE_KEY,CLERK_WEBHOOK_SIGNING_SECRET`.
6. **Supabase:** ensure the `personalization_discovery_jobs` table exists
   (the function's durable mirror is service-role only).
7. **Register the Clerk webhook** in the Clerk dashboard pointing at
   `https://<site>/.netlify/functions/clerk-webhook` (user
   created/updated/deleted events).
8. **Deploy preview first:** `netlify deploy` (no `--prod`), then run the
   three smoke tests in §8 before any production promote.

## 10. Blockers

- None in code or configuration. The build passes; the function is
  Netlify-compatible.
- Operational gates only: no Netlify auth token / linked site in this
  environment (no preview possible from here), and the server/client env
  vars in §9 step 2–3 are not yet set anywhere reachable from this machine.
