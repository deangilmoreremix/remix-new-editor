# SmartVid MCP: deploy and live check

Nothing here has been run against a real deployment yet. This is the checklist for doing that once, and for reading the result.

## 1. Database
Apply `supabase/migrations/20261118000000_mcp_keys.sql` to the Supabase project the Netlify functions use (SQL editor, or `supabase db push`). It creates `public.mcp_keys` with row-level security on and no client grants.

Check: in the SQL editor, `select count(*) from public.mcp_keys;` works with the service role and fails for the `anon` role.

## 2. Environment (Netlify → Site settings → Environment variables)
| Variable | Value | Read by |
|---|---|---|
| `MCP_KEY_SECRET` | 32+ random characters, e.g. `openssl rand -base64 48`. **Required.** Changing it makes every stored MCP key unusable (users create new ones). | `_shared/mcpKeys.js` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | already set for other functions | `_shared/mcpKeys.js` |
| `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` (or the existing `CLERK_*` settings) | already set | `_shared/clerkAuth.js` |
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

## Rollback
1. Revoke keys: `update public.mcp_keys set revoked_at = now() where revoked_at is null;`
2. Unset nothing else: with no valid keys the gateway answers 401 to everything.
3. Remove completely: `drop table public.mcp_keys;` and delete `netlify/functions/mcp-*.js` plus the two redirects.

## What a pass does and does not show
A ✔ means the tool returned a finished result for one cheap input through the real gateway. It does not mean every model of that kind works, or that output quality is right.
