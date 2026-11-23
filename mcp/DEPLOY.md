# SmartVid MCP: deploy and live check

Nothing here has been run against a real deployment yet. This is the checklist for doing that once, and for reading the result.

## 1. Database
Apply these to the Supabase project the Netlify functions use (SQL editor, or `supabase db push`), in order. Each creates its tables with row-level security on and no client grants:
1. `20261118000000_mcp_keys.sql`: `public.mcp_keys` (key hashes, encrypted upstream keys).
2. `20261123000000_mcp_governor.sql`: `public.mcp_usage_daily` (per-key daily counts for delete and publish actions), `public.mcp_audit` (tool, risk, outcome, time; no arguments or content) and the `mcp_usage_incr` function.
3. `20261123010000_mcp_bridge.sql`: `public.mcp_bridge_sessions` and `public.mcp_bridge_commands` (the live-tab bridge queue).
4. `20261124000000_mcp_rate_expiry.sql`: `mcp_keys.expires_at` (optional key expiry) and `public.mcp_rate_window` with the `mcp_rate_hit` function (the per-key request limit). **Apply this before deploying this version**: the key list now reads `expires_at`, so it fails on a database without the column. Without the rate function the limiter quietly falls back to a per-instance counter.

Check: in the SQL editor, `select count(*) from public.mcp_keys;` (and each other table) works with the service role and fails for the `anon` role.

## 2. Environment (Netlify → Site settings → Environment variables)
| Variable | Value | Read by |
|---|---|---|
| `MCP_KEY_SECRET` | 32+ random characters, e.g. `openssl rand -base64 48`. **Required.** Changing it makes every stored MCP key unusable (users create new ones). | `_shared/mcpKeys.js` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | already set for other functions | `_shared/mcpKeys.js` |
| `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` (or the existing `CLERK_*` settings) | already set | `_shared/clerkAuth.js` |
| `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`) | **Needed for Video Pages tools.** The gateway signs a 5-minute identity token for the key's owner (same claims as `supabase-token.js`) so the database's own row-level security applies. Without them `video_pages_*` answer "not configured". | `_shared/ownerSupabase.js` |
| `DIRECTOR_API_URL` | Address of your separately deployed Director backend (`apps/director/backend`), https only (`http://localhost` allowed for development). **Optional**: unset, every `director_*` tool except `director_health` answers "not configured" and `director_health` says so. | `_shared/mcpDirector.js` |
| `DIRECTOR_API_TOKEN` | Optional. Sent as `Authorization: Bearer` to the Director backend if you put it behind a gateway that checks one (the backend itself has no auth). Backend-side keys (VideoDB, OpenAI, ...) are set on the backend's own host, never here. | `_shared/mcpDirector.js` |
| `MCP_CAP_DESTRUCTIVE`, `MCP_CAP_PUBLISH` | Optional per-key daily limits for delete/overwrite and publish actions (defaults 50 and 20; they reset at midnight UTC). | `mcp-gateway.js` |
| `MCP_RATE_PER_MIN` | Optional. Requests per key per minute (default 120; `0` turns the limit off). Counted in Supabase when configured, so it holds across function instances. | `mcp-gateway.js`, `mcp-http.js` |
| `MCP_KEY_MAX_DAYS` | Optional. New keys expire after this many days (default for new keys, and the cap on what a user may ask for). Unset: keys do not expire. | `mcp-keys.js` |
| `MCP_REQUIRE_ENTITLEMENT` | `1` to require the paid feature when a user creates a key. Optional. | `mcp-keys.js` |
| `MCP_ALLOW_BYOK` | **leave unset in any deployed environment.** Local development only. | `mcp-gateway.js` |
| `OPENAI_RESPONSES_TEXT_MODEL` etc. | existing; Zack D text steps use the user's own OpenAI key | `zackd.js` |

Add `MCP_KEY_SECRET` to `SECRETS_SCAN_OMIT_KEYS` in `netlify.toml` only if the secrets scan flags it.

## 3. Deploy a preview
Push the branch; Netlify builds a deploy preview (project rule: Netlify only, no GitHub Actions). The build runs `npm run lint` and `npm run build`. Routes added: `/api/mcp-keys` and `/api/mcp-gateway/*` (see `netlify.toml`).

Then set the real gateway address in `mcp/brand.js` (`gatewayUrl`), or pass `--url` / `SMARTVID_API_URL` for the preview: `https://<preview>.netlify.app/api/mcp-gateway`.

## 4. Create a key
Sign in on the preview, open Settings, save your API keys, then **MCP access → Create MCP key**. Copy it now; it is shown once.

## 5. Look before you spend
```bash
SMARTVID_API_KEY=sv_live_... SMARTVID_API_URL=https://<preview>.netlify.app/api/mcp-gateway \
  node scripts/mcp-smoke.mjs --sample-image https://<public image> --sample-video https://<public short video> --sample-url https://<your site>
```
With no spend flags it checks the key (balance), asks the estimate route for prices, prints the plan with its estimated total, and exits with code 2 without generating anything. Read the plan. Prices come from the estimate route; custom tools marked "(assumed)" use a fixed figure I picked, not a measured price.

Useful options: `--only t2i,i2i,tool:music_create` to run part of it, `--candidates 12` to compare more models per kind, `--sample-audio URL`, `--allow-unknown-cost` (runs the first candidate when an estimate cannot be read).

## 6. Run it
```bash
SMARTVID_API_KEY=... SMARTVID_API_URL=... node scripts/mcp-smoke.mjs <same sample flags> --confirm-spend 3 --yes
```
It stops before any call that would push the running estimate past the cap. It writes `mcp/smoke-results.json`.

Then:
```bash
npm run mcp:coverage
```
rewrites `mcp/COVERAGE.md` with a Live column per studio (a studio is ✔ only when every model kind and custom tool it uses passed) and the gateway checks. Commit both files.

The run also reports which verb the upstream status route accepted (the gateway tries GET and falls back to POST and says which one worked). If it prints POST, change nothing: the gateway already handles it, but record it.

## 7. Checks the script cannot do
- **Revoked key:** in Settings → MCP access revoke the key, then call any tool again: expect "Missing, invalid or revoked SmartVid MCP key".
- **Deleted account:** `clerk-webhook` revokes all keys on `user.deleted`. Delete a throwaway account and confirm its key stops working.
- **Not entitled:** with `MCP_REQUIRE_ENTITLEMENT=1`, creating a key from an account without `smartvideo_full_access` returns 403.
- **Wrong secret:** with a different `MCP_KEY_SECRET`, existing keys return 401 (the stored API keys cannot be decrypted).
- **Real MCP client:** `claude mcp add smartvid -e SMARTVID_API_KEY=sv_live_... -e SMARTVID_API_URL=... -- node mcp/index.js`, then ask Claude to list studios and make one image.

## Safeguards and the live-tab bridge
- Actions that delete, overwrite or publish (`leads_delete`, `video_pages_publish`/`_delete`, `social_publish`, ...) need `confirm: true` and count against the daily caps above. Every call is written to `mcp_audit`.
- Tab tools (timeline, workbench, motion director, render queue, brand store, app navigation) need the studio open in a signed-in tab and the user to switch on "Let MCP control this tab". Read tools run silently; everything else asks in the page. Check this in a real browser: nothing in this repo has exercised it outside simulated tests.
- Social publishing lists accounts connected in the app and publishes to them; connecting accounts stays in the app.

## Director
The Director backend has no accounts: its collections and sessions are shared by everyone who can reach it. The gateway therefore does the isolation, per MCP key owner: collections are created with an owner tag (a hash of the user id) in their name and are only listed, read, written or deleted when the name carries the caller's tag; session and conversation ids are tagged and checked the same way; every agent run needs one of the caller's collections, so it never falls back to a shared default; only the routes in `mcp/studios.json` -> `director` (allow-list in `_shared/mcpDirector.js`) are forwarded, with size caps and https-only media links. Treat the backend as private: it must not be reachable by users directly, because anyone who can call it directly bypasses these checks. Collections created in the Director page itself carry no tag and are intentionally invisible to MCP keys.
Limits to expect: a Netlify function answers within about 26 seconds, so the gateway gives the backend 25 seconds per call; long agent runs may come back as "could not be reached" even though the backend carries on. The collection and session response shapes are read from the backend's source (`routes.py`, `videodb_tool.py`), not from a running instance.
Check after deploying: `director_health`, then create a collection with two different users' keys and confirm neither can see the other's.

## Hosted endpoint and the npx package
- **`/api/mcp`** (`netlify/functions/mcp-http.js`, redirect in `netlify.toml`): the MCP over streamable HTTP, stateless, POST only, `Authorization: Bearer sv_live_...`. It calls the gateway in the same function (no extra network hop), so the confirm rule, daily caps and audit log apply as they do for a local MCP. Netlify functions answer within about 26 seconds; long generations return a request id to poll, as they already do. Check after deploying: `claude mcp add --transport http smartvid https://<preview>/api/mcp --header "Authorization: Bearer <key>"`, then ask Claude to list studios. Nothing about this has run on Netlify yet: the tests call the handler directly with the MCP client library.
- **`smartvid-mcp`** (`packages/smartvid-mcp`): `npm --prefix packages/smartvid-mcp run build` writes one bundled file; `npm pack --dry-run` in that folder lists exactly `dist/index.js`, `README.md` and `package.json`. **Publishing is yours**: it needs your npm account, a free package name and `npm publish`. Before publishing, set the real address in `mcp/brand.js` (`gatewayUrl` is still a guess) and re-run the build.

## Rollback
1. Revoke keys: `update public.mcp_keys set revoked_at = now() where revoked_at is null;`
2. Unset nothing else: with no valid keys the gateway answers 401 to everything.
3. Remove completely: `drop table public.mcp_bridge_commands, public.mcp_bridge_sessions, public.mcp_audit, public.mcp_usage_daily, public.mcp_rate_window, public.mcp_keys;` (and `drop function public.mcp_usage_incr(uuid, date, text); drop function public.mcp_rate_hit(uuid, timestamptz);`), delete `netlify/functions/mcp-*.js` plus the redirects.

## What a pass does and does not show
A ✔ means the tool returned a finished result for one cheap input through the real gateway. It does not mean every model of that kind works, or that output quality is right.
