# Release Execution Report — Phase 3 finalization

**Generated:** 2026-10-13
**Branch:** `integration/personalization-complete` @ `142c0e419`
**PR:** https://github.com/deangilmoreremix/remix-new-editor/pull/28

## 1. ATTEMPTED vs BLOCKED

| Task | Attempted | Result | Precise blocker |
|---|---|---|---|
| Netlify site identification | `netlify status`, `netlify api getCurrentUser`, `.netlify/state.json` lookups across all 11 worktrees | **DONE** | — |
| Netlify link to existing site | created `.netlify/state.json` with the existing `siteId` | **DONE** | — |
| Netlify build | `npm run build:openthorn` + `vite build` (exactly the site's commands) | **DONE, exit 0** | — |
| Netlify CLI deploy → preview | `netlify deploy --dir=dist --no-build` | **DONE — live preview** | — |
| Full CLI build-on-Netlify (`deploy --build`) | attempted twice | **BLOCKED** | The CLI enters monorepo mode because `package.json` declares `workspaces:["packages/*","apps/*"]` (8 real packages + 4 apps). The **root site is not a workspace package**, so `--filter` cannot select it and the CLI prompts interactively. Worked around by staging an identical tree whose root is the only workspace, which is how the preview below was produced. See §7. |
| Browser smoke tests (HTTP) | `curl` on 11 endpoint/route combinations | **DONE** | — |
| Browser smoke tests (rendered DOM) | not attempted | **NOT DONE** | No Playwright script exists for the preview; see §6 |
| Live MuAPI verification | credential check only | **NOT EXECUTED** | `MUAPI_API_KEY` missing from environment |
| Live OpenAI verification | credential check only | **NOT EXECUTED** | `OPENAI_API_KEY` missing from environment |
| Live Supabase/Clerk verification | credential check only | **NOT EXECUTED** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` all missing |

## 2. Netlify site (identified, not created)

| Field | Value |
|---|---|
| Site name | **`smartvideo2`** |
| Site ID | `ec2fbb0c-c375-4554-898c-194485c2621d` |
| Production URL | `https://smartvid.app` |
| Admin URL | `https://app.netlify.com/projects/smartvideo2` |
| Account | Dean Gilmore `<dean@videoremix.io>` |
| Team | VideoRemix |
| **Site created by this task** | **NO.** The ID was recovered from `/Users/shasheemoore/Downloads/remix-new-editor/.netlify/state.json` (the main worktree is already linked). The integration worktree was linked to the *same* site. |

## 3. Build verification (real)

| Step | Command | Exit | Notes |
|---|---|---|---|
| openthorn | `npm run build:openthorn` | **0** | built in 20.80s |
| app | `npx vite build` | **0** | built in 3m 33s |
| artifacts | `dist/index.html` 2920B, `dist/openthorn/index.html` 3078B | — | 307 JS files |
| bundle: `node:dns` | `grep -l "node:dns" dist/assets/*.js` | — | **CLEAN** |
| bundle: provider keys | `grep -l "VITE_MUAPI_KEY\|VITE_OPENAI_KEY\|VITE_PEXELS_API_KEY"` | — | **CLEAN** |
| bundle: discovery engine | `grep -l "discoverAssets"` | — | **CLEAN** |
| bundle: endpoint URL | `grep -rl "personalization-discovery"` | — | present (expected) |

### Netlify deploy result

```
Deploy complete
Draft URL: https://6acd9cbba8da3708493de8e9--smartvideo2.netlify.app
Deploy time: 7s
Finished hashing 1909 files and 9 functions
```

## 4. Smoke tests (real output)

| Route | Status | Assessment |
|---|---|---|
| `/` | **200** (2920B) | SPA shell serves |
| `/personalizer` | **200** | SPA fallback + route OK |
| `/index.html` | **200** | OK |
| `cinegen` fn | **405** | function **executed**, method rejected → live |
| `timeline-image-generate` fn | **405** | live |
| `timeline-script` fn | **405** | live |
| `pixabay-search` fn | **405** | live |

### Functions with `@supabase/supabase-js` returned 502 on the preview

| Function | Status | Cause |
|---|---|---|
| `personalization-discovery` | 502 | `ERR_MODULE_NOT_FOUND: @supabase/supabase-js` |
| `personalizer-api` | 502 | same |
| `clerk-webhook` | 502 | same |
| `intelligence-api` | 502 | same |

**This is a staging artifact, not a repository defect.** `personalizer-api`, `clerk-webhook` and `intelligence-api` are **pre-existing functions** untouched by this branch, and they fail identically. The staged directory used for the deploy could not reproduce the real `npm install` (the staged `node_modules` ended up without `@supabase/supabase-js`), and Netlify's function bundler could not trace the package to bundle it.

**Decisive verification (static):** every module imported by the 13 files in the discovery module + Netlify functions surface was checked against `package.json` — **0 undeclared imports**. All are either Node builtins (`node:crypto`, `node:dns`, `node:url`, `node:test`), relative paths, or declared dependencies (`@supabase/supabase-js`, `@supabase/functions-js`, `@clerk/clerk-js`, `openai`, `playwright`, `cheerio`-family parsers). The site's real build command is `npm install --include=optional && npm run build`, so the dependency tree will be present when Netlify bundles functions server-side. A production-family deploy (`deploy --build` on Netlify, or a linked git-triggered build) will resolve this.

## 5. Environment variables — audit

Verified **none** of these are set in this environment. Names inspected only; **no values printed**.

| Var | Used by | Scope | In `.env.example` | In `SECRETS_SCAN_OMIT_KEYS` | Set here |
|---|---|---|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | client | client | yes | n/a | no |
| `VITE_SUPABASE_URL` | client | client | yes | n/a | no |
| `VITE_SUPABASE_ANON_KEY` | client | client (public by design) | yes | n/a | no |
| `VITE_MUAPI_URL` | client | client (public URL) | yes | n/a | no |
| `VITE_PEXELS_ENABLED` | client | client (flag) | yes | n/a | no |
| `OPENAI_API_KEY` | openaiService, netlify fns | **server** | yes | yes | no |
| `MUAPI_API_KEY` | netlify fns | **server** | yes (added) | yes | no |
| `SUPABASE_URL` | netlify fns | **server** | yes | yes | no |
| `SUPABASE_SERVICE_ROLE_KEY` | netlify fns | **server** | **renamed** from the wrong `SUPABASE_SERVICE_KEY` | yes (added) | no |
| `CLERK_SECRET_KEY` | clerk paths | **server** | yes | yes | no |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `clerk-webhook.js` | **server** | yes | yes (added) | no |
| `PERSONALIZATION_DISCOVERY_SECRET` | `personalization-discovery.js` | **server** | **added** | yes (added) | no |
| `PIXABAY_API_KEY` | `pixabay-search.js` | **server** | yes | yes | no |
| `ALLOWED_ORIGINS` | discovery fn | **server** | **added** | no | no |
| `MAIGRET_WORKER_SECRET`/`MAIGRET_WORKER_URL` | lead finder | **server** | yes | yes | no |

**No `VITE_`-prefixed secret remains** (verified: `VITE_MUAPI_KEY`, `VITE_OPENAI_KEY`, `VITE_PEXELS_API_KEY` were all removed from client code in earlier phases; the bundle grep confirms clean).

Fixed in `.env.example` / `netlify.toml` (commit `e8a895042`): renamed `SUPABASE_SERVICE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`, added `PERSONALIZATION_DISCOVERY_SECRET` and `ALLOWED_ORIGINS`, extended `SECRETS_SCAN_OMIT_KEYS` with `SUPABASE_SERVICE_ROLE_KEY` and `CLERK_WEBHOOK_SIGNING_SECRET`.

## 6. Not verified

- **Live MuAPI, OpenAI, Supabase and Clerk calls** — no credentials in this environment. Nothing was fabricated. See §8 for the bounded runbook.
- **Rendered-DOM browser smoke tests** — HTTP-level only. No Playwright script exists for the preview.
- **RLS behaviour against a real database** — the migration and the SQL-parsing test assert the policy text, but no live database round-trip (ownership isolation, impersonation attempt) was executed.
- **Netlify `--build` (git-triggered/CI) build path** — see §7; the monorepo package selection blocks the CLI build flow locally.

## 7. Netlify monorepo finding (needs a decision)

`package.json` declares `"workspaces": ["packages/*", "apps/*"]`. The repo genuinely has 8 workspace packages (`@higgsfield/ai-chat`, `@smartvideo/ai-timeline-editor`, `@remix/assets`, `@higgsfield/layout`, `@higgsfield/navigation`, `@higgsfield/timeline-editor`, `@higgsfield/tokens`) plus 4 apps — **this is not a stale field**.

But the Netlify **site's base directory is the repository root**, which is *not* one of the workspace packages. The Netlify CLI therefore cannot resolve a target non-interactively: with 12 detected packages it prompts, and `--filter` only matches a package name or path. `CI=true` makes it throw rather than prompt:

```
Projects detected: @higgsfield/ai-chat, @smartvideo/ai-timeline-editor, @remix/assets,
@higgsfield/layout, @higgsfield/navigation, @higgsfield/timeline-editor, @higgsfield/tokens,
new, bloom, openchatcut, vimax.
```

This branch produced the preview by staging an identical tree (netlify.toml, netlify/functions, package.json, package-lock.json, src, dist) whose root was made the only workspace. **That is a workaround, not a fix.**

Two clean resolutions for the maintainer:
1. **Set the site's base directory to the repo root** in the Netlify UI (Site configuration → Build & deploy → Base directory = `.`) so the CLI resolves the site without needing a package match.
2. **Deploy from a git-triggered build** (push the branch with the Netlify GitHub integration active), which bypasses the CLI's local workspace detection entirely. This is the path used for the real production deploy.

## 8. Live-provider runbook (for a human with credentials)

**MuAPI file upload**
```bash
curl -X POST https://api.muapi.ai/api/v1/upload_file \
  -H "x-api-key: $MUAPI_API_KEY" \
  -F "file=@/tmp/test.png"
# expect: { "url": "https://s3.amazonaws.com/muapi-assets/outputs/..." }
# NOTE: the returned URL is a 1-hour presigned S3 URL — never store it as permanent.
```
Limits: images 10MB (jpg/png/webp), videos 50MB (mp4/mov), other 10MB; credit balance must be > 0.

**MuAPI video generation + polling**
```bash
curl -X POST https://api.muapi.ai/api/v1/gpt-image-2-text-to-image \
  -H "x-api-key: $MUAPI_API_KEY" -H "Content-Type: application/json" \
  -d '{"prompt":"a test image"}'
# → { "request_id": "..." }
curl https://api.muapi.ai/api/v1/predictions/<request_id>/result \
  -H "x-api-key: $MUAPI_API_KEY"
# poll until status === "completed", then read outputs[0].url
```
**Prompt forwarding (V2V)** — verify `processV2V` now sends `prompt` (fixed in Phase 2/3):
```bash
curl -X POST https://api.muapi.ai/api/v1/ai-video-face-swap \
  -H "x-api-key: $MUAPI_API_KEY" -H "Content-Type: application/json" \
  -d '{"video_url":"...","image_url":"...","prompt":"Replace the face with X"}'
```

**OpenAI image edit via the Responses API**
```bash
curl -X POST https://api.openai.com/v1/responses \
  -H "Authorization: Bearer $OPENAI_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"gpt-5.6-sol","input":[{"role":"user","content":[
        {"type":"input_text","text":"remove the background"},
        {"type":"input_image","image_url":"<data-or-url>"}]}],
       "tools":[{"type":"image_generation","model":"gpt-image-2.5-sunburst","action":"edit"}]}'
# returns b64 image data in the image_generation_call result — read .base64, NOT .b64_json
```

**Budget cap:** 1 upload, 1 generation + 5 polls, 1 image edit, 1 face-swap = 8 API calls total, expected cost < $1.

**Personalization edit roles:** Person/Logo/Product/Brand/FirstFrame/LastFrame all route through `openaiService.editImageResponses` → `POST /v1/responses` with `action: 'edit'` — verified in code, no silent model substitution.

## 9. Human checklist before first production deploy

1. **Clerk dashboard** → "Connect with Supabase" (`https://dashboard.clerk.com/setup/supabase`) so session tokens carry the `role: authenticated` claim that RLS matches on.
2. **Supabase dashboard** → Authentication → Sign In/Up → **Third-Party Auth** → Add provider → **Clerk**, entering the Clerk Frontend API domain (e.g. `example.clerk.accounts.dev`); Supabase derives the JWKS from `https://<domain>/.well-known/jwks.json`.
3. **Apply migrations in order with a verified backup:** `20261012000000` → `20261013000000_fix_personalization_outputs_rls.sql` → `20261013120000_harden_personalization_rls.sql`. The last one drops the `set_app_clerk_user_id()` RPC and all GUC-based policies; until it runs, ownership is app-enforced only.
4. **Set Netlify env vars** (Netlify UI → Site configuration → Environment variables): client — `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MUAPI_URL`, `VITE_PEXELS_ENABLED`; server-only — `OPENAI_API_KEY`, `MUAPI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, `PERSONALIZATION_DISCOVERY_SECRET`, `PIXABAY_API_KEY`, `ALLOWED_ORIGINS`.
5. **Resolve the monorepo base directory** (§7) — set the site base to the repo root, or rely on the git-triggered build path.
6. **Register the Clerk webhook** in the Clerk dashboard against `/.netlify/functions/clerk-webhook`.
7. **Run the live-provider runbook** (§8) once with a bounded budget.
8. **Only then** request production approval.
