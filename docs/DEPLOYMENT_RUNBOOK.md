# General Production Deployment

This section covers the operational steps required to deploy the main editor app (Vite frontend + Supabase Edge Functions) to production. Director-feature-specific deployment lives below in §11.

---

## A1. Pre-Flight Environment Variables

### A1.1 Vite Frontend (`apps/editor` or repo root Vite app)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `VITE_SUPABASE_URL` | **Yes** | `https://xxx.supabase.co` | Public Supabase project URL. Used by `src/lib/supabase.js`. |
| `VITE_SUPABASE_ANON_KEY` | **Yes** | `eyJ...` | Supabase anon key (safe to ship to the browser). |
| `VITE_ENABLE_ANALYTICS` | **No** | `true` | Enables the client-side `trackGeneration` calls into the `/api/analytics` endpoint. Defaults to `false`. |

### A1.2 Supabase Edge Functions

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes (for muapi-proxy + analytics)** | `eyJ...` | Service role key, set via `supabase secrets set`. Never exposed to the client. |
| `APP_ORIGIN` | **Yes (prod)** | `https://app.example.com` | Used by `muapi-proxy` to validate `Origin` / `Sec-Fetch-Site` for CSRF defense-in-depth. Must match the deployed frontend origin. |
| `ALLOW_UNAUTHENTICATED` | **Yes (prod)** | `false` | When `false` (or unset) in production, the proxy rejects requests authenticated only by the Supabase anon key. **Must be `false` in production.** Set to `true` only for local development. |
| `OPENAI_API_KEY` | **Yes (for OpenAI Responses path)** | `sk-...` | Used by `openaiService.js` for the storyboard OpenAI Responses call. |

### A1.3 Frontend Hardening

- `VITE_DEV_BYPASS_AUTH` must **NOT** be set in production. `isDevBypass` in `apiKeyManager.js` is hard-disabled when `import.meta.env.MODE === 'production'`.
- `SUPABASE_ENV=production` is read by `muapi-proxy` to disable CORS wildcard fallbacks and reject anon-only auth.

---

## A2. Build Steps

```bash
# 1. Install dependencies
npm install

# 2. Build the Vite frontend (writes to dist/)
npm run build

# 3. Deploy Supabase Edge Functions
cd supabase
supabase functions deploy muapi-proxy
supabase functions deploy ai-thumbnail-generator
# (deploy analytics if it ships as a separate function: supabase functions deploy analytics)
```

After `npm run build`, deploy `dist/` to your static host (Vercel, Netlify, Cloudflare Pages, Render Static Site, etc.) per your platform's standard flow.

---

## A3. Post-Deploy Smoke Tests

Run these in order after each deploy. Replace `APP` with your production frontend URL and `SUPABASE` with your Supabase project URL.

```bash
APP="https://app.example.com"
SUPABASE="https://xxx.supabase.co"

# 1. Frontend root responds
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$APP/"

# 2. Analytics endpoint accepts a test payload
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  -X POST "$SUPABASE/functions/v1/analytics" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event":"test","studio":"smoke","ts":"2026-07-31T00:00:00Z"}'
# Expected: HTTP 200 or 204

# 3. muapi-proxy health (if exposed)
curl -s -o /dev/null -w "HTTP %{http_code}\n" "$SUPABASE/functions/v1/muapi-proxy/health"
# Expected: HTTP 200 (or 404 if /health is not implemented — that's fine, proceed)

# 4. Rate-limit verification — send 5 quick requests, the 6th should 429
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w "req $i: HTTP %{http_code}\n" \
    -X POST "$SUPABASE/functions/v1/muapi-proxy/test" \
    -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"input":"smoke"}'
done
# Expected: requests 1–5 return 200/4xx, request 6 returns HTTP 429
# (200 tokens/hour per IP for the user-facing path)

# 5. Security headers present on muapi-proxy responses
curl -s -D - -o /dev/null \
  -X POST "$SUPABASE/functions/v1/muapi-proxy/test" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}' | grep -iE "^(strict-transport-security|x-frame-options|referrer-policy|x-content-type-options):"
# Expected: all four headers present
```

---

## A4. Monitoring

| System | Command / Link | Notes |
|--------|---------------|-------|
| **muapi-proxy logs** | `supabase functions logs muapi-proxy --project-ref <ref>` | Primary debug source for Edge Function errors, rate-limit hits, CSRF rejections, and auth failures. |
| **ai-thumbnail-generator logs** | `supabase functions logs ai-thumbnail-generator --project-ref <ref>` | Thumbnail generation telemetry. |
| **Analytics events** | Tailed in the muapi-proxy / analytics function logs | Filter on `analytics` or `trackGeneration` to see per-studio generation counts. For richer dashboards, pipe to your log sink (Datadog, Logflare, etc.). |
| **Rate-limit hits** | `supabase functions logs muapi-proxy --project-ref <ref> \| grep "rate limit"` | Sudden spikes indicate either a misbehaving client or a real abuse pattern. |
| **Frontend bundle** | Check the `dist/` chunk report from `npm run build` | Confirms the `@huggingface/transformers` / `tiktoken` split from the Vite `manualChunks` change. |

---

## A5. Rollback

### A5.1 Roll back a Supabase Edge Function

```bash
# List the last 5 deployed versions
supabase functions list --project-ref <ref>

# Re-deploy a previous version by its version ID
supabase functions deploy muapi-proxy --version <previous-version-id>
```

### A5.2 Roll back the Vite frontend build

```bash
# Option A — redeploy the previous dist/ from your static host's UI
# (Vercel/Netlify/Cloudflare all keep prior deploys and let you promote one with a click)

# Option B — rebuild from a known-good git ref and redeploy
git checkout <last-known-good-tag>
npm install
npm run build
# then push dist/ via your platform's CLI
```

### A5.3 Emergency kill-switches

```bash
# Disable analytics ingestion without redeploying
supabase secrets set VITE_ENABLE_ANALYTICS=false --project-ref <ref>
# (then redeploy the frontend so the new build sees the flag)

# Allow unauthenticated traffic temporarily (DEV ONLY — never in production)
supabase secrets set ALLOW_UNAUTHENTICATED=true --project-ref <ref>
```

---

## A6. Security Checklist

Confirm each item before promoting to production:

- [ ] **HSTS header present** on all `muapi-proxy` responses: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- [ ] **`X-Frame-Options: DENY`** present on all `muapi-proxy` responses (clickjacking defense)
- [ ] **`Referrer-Policy: strict-origin-when-cross-origin`** present
- [ ] **`X-Content-Type-Options: nosniff`** present
- [ ] **`ALLOW_UNAUTHENTICATED` is `false` (or unset) in production** — verify via `supabase secrets list --project-ref <ref>`
- [ ] **Rate limit returns 429 after threshold** — confirmed by the 6-request smoke test in §A3.4
- [ ] **`VITE_DEV_BYPASS_AUTH` is NOT set** in the production frontend env
- [ ] **CORS is not wildcard `*`** in production — `SUPABASE_ENV=production` enforces the `ALLOWED_ORIGINS` / `APP_ORIGIN` allow-list
- [ ] **CSRF checks active** — `Sec-Fetch-Site: same-origin` and `Origin` validation reject cross-site state-changing requests
- [ ] **No user-supplied raw HTML rendered** — all prompt/seed text flows through `escapeHtml` / `sanitizeUserInput` helpers in the 8 audited studios

---

# Director Feature — Deployment Runbook

This runbook covers the operational steps required to deploy the Director feature (director-backend + director-frontend + director-proxy on the existing node backend) to production on Render. All blocking items from the staging verification checklist must be green before deploying.

---

## 1. Pre-Flight Checks

### 1.1 Environment Variables

**Director Backend (Python FastAPI) — `apps/director/backend`**
| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `SERVER_ENV` | **Yes** | `production` | Activates production guards. |
| `SERVER_SECRET_KEY` | **Yes** | `random-128-char-hex` | Session/auth signing key. Must be set in `render env set`. |
| `VIDEO_DB_API_KEY` | **Yes** | `vdbt-...` | Used by `/proxy-videodb` to call `api.videodb.io`. Director will return 502 on all agent calls if missing. |
| `OPENAI_API_KEY` | **Yes** | `sk-...` | OpenAI key for chat / TTS used by Director agents. |
| `POSTGRES_DB` | **Yes** | from Render `director-db` | Auto-injected by Render database binding. |
| `POSTGRES_USER` | **Yes** | from Render `director-db` | Auto-injected by Render database binding. |
| `POSTGRES_PASSWORD` | **Yes** | from Render `director-db` | Auto-injected by Render database binding. |
| `POSTGRES_HOST` | **Yes** | from Render `director-db` | Auto-injected by Render database binding. |
| `POSTGRES_PORT` | **Yes** | from Render `director-db` | Auto-injected by Render database binding. |
| `DB_TYPE` | **Yes** | `postgres` | Must be `postgres`. |

**Director Frontend — `apps/director/frontend`**
| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `VITE_APP_BACKEND_URL` | **Yes** | Render-injected `RENDER_EXTERNAL_URL` for `director-backend` | Used by frontend to call `director-backend` REST API. Must match the backend region. |
| `VITE_BACKEND_URL` | **Actually this goes on the frontend mixin from the editor app** — set on the React/Vite app that lives next to the editor | The `videoagent-backend` URL (e.g. `https://videoagent-backend.onrender.com`) | Sent by the editor shell to the Director frontend. See `render.yaml`. |

**VideoAgent Backend (Node/Express) — `backend/`**
| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `OPENAI_API_KEY` | **Yes** | `sk-...` | TTS/STT used by `agentActionsService`. |
| `MUAPI_API_KEY` | **No longer used** | — | Removed. Users must supply their own Muapi key in Settings. The server no longer provides a fallback. |
| `DIRECTOR_BASE_URL` | **Yes (production)** | `https://director-backend.onrender.com` | Points `directorProxy.js` at the deployed Director backend. **Must NOT be `localhost:8000` in production**. |
| `VIDEO_DB_API_KEY` | **Optional** | `vdbt-...` | Server-side VideoDB key used by `directorProxy.js` chat fallback. |
| `SUPABASE_URL` | **Conditional** | `https://xxx.supabase.co` | Required if agent actions store assets in Supabase Storage. |
| `SUPABASE_SERVICE_KEY` | **Conditional** | `eyJ...` | Required if agent actions store assets in Supabase Storage. |
| `FFMPEG_PATH` | **No** | `ffmpeg` | Defaults to `ffmpeg` binary from `ffmpeg-static`. |

**Note:** `VITE_DEV_BYPASS_AUTH` must **NOT** be set in production on any frontend. Every frontend (director-frontend and the editor shell) hard-disables the bypass under `import.meta.env.MODE === 'production'`.

### 1.2 Muapi Key Architecture

The `muapi-proxy` Supabase Edge Function (used for Muapi stock footage search, image generation, etc.) uses **per-user API keys only**. Users must bring their own Muapi account and key; there is no server-side fallback.

**Flow (user-supplied key):**
1. User opens the editor's **Settings modal** and pastes a `muapi-...` key.
2. `apiKeyManager` (browser) persists the key in `localStorage` under the Muapi provider slot.
3. The editor's API client (`services/muapiClient.js` or equivalent) attaches the key to every `muapi-proxy` request as an `x-api-key` header.
4. The Supabase `muapi-proxy` function reads the header, forwards it to `https://api.muapi.ai/...` as the upstream `x-api-key`, and adds a `x-key-source: user` response header for observability.

**Key extraction order in `muapi-proxy` (first non-empty wins):**
1. `body.muapi_api_key` (top-level body field)
2. `body.params.muapi_api_key` (nested params, used by some agent action payloads)
3. `x-api-key` request header (the standard user-supplied path from Settings modal)

If none resolve to a non-empty value, the function returns HTTP 500 `{ error: "No Muapi API key available" }`.

**Dev-bypass behavior:**
- The dev-only placeholder `dev-bypass-key-not-real` (used in some local `agentActionsService` mocks) is **not** treated as a real key by the proxy. It is rejected upstream by `api.muapi.ai`. This is intentional — production traffic must use a real user key.

**Observability:**
- The `muapi-proxy` function returns an `x-key-source: user` response header on every successful resolution. This is logged by the editor's API client and forwarded into error reports so support can distinguish "user key invalid" from "user key missing" without ever logging the key itself.

**Security:**
- User-supplied keys are stored in `localStorage` only (never in cookies, never in the DB). They are sent **only** to the Supabase `muapi-proxy` over HTTPS, and the proxy forwards them to `api.muapi.ai`. The key value is never written to logs, error responses, or the response back to the client.
- The `muapi-proxy` function does not accept CORS from arbitrary origins in production — only the editor frontend origin.

### 1.3 Feature Flags
- `VITE_ENABLE_ANALYTICS` — optional; defaults to `false` for Director frontend
- `VITE_ENABLE_ERROR_TRACKING` — optional; set to `true` and configure `VITE_SENTRY_DSN` to enable error tracking on `director-frontend`

### 1.4 Database Migrations
Run all pending migrations on the `director-db` PostgreSQL instance before deploying the Director backend. Check `apps/director/backend/director/migrations/` for pending Alembic migrations.

**If using raw SQL (no Alembic present):**
```bash
# Connect to the director-db
psql "$DATABASE_URL" -c "\dt"                       # list tables
psql "$DATABASE_URL" -f apps/director/backend/migrations/latest_migration.sql
```

**If using Alembic:**
```bash
cd apps/director/backend
PYTHONPATH=. alembic upgrade head
```

### 1.5 Health Checks (Manual Pre-Flight)
Before starting the deployment, confirm the following from your local machine:

```bash
# VideoAgent Backend (staging or current production)
curl -i https://staging-backend-url.onrender.com/health
# Expected: HTTP 200, {"status":"ok","timestamp":"..."}
P95 target: < 500ms

# Director Backend (already running service — do NOT redeploy yet)
curl -i "https://staging-director-url.onrender.com/health"
# Expected: HTTP 200 with Director-specific service status.
# If 502 / 503, fix the backend service before proceeding.
```

---

## 2. Build Steps

### 2.1 Build Director Backend (Python)

```bash
cd apps/director/backend

# Install dependencies
pip install --no-cache-dir -r requirements.txt -r requirements-dev.txt

# Run any pending DB migrations
PYTHONPATH=. alembic upgrade head   # if Alembic-managed
# or apply raw SQL migrations as described in §1.3

# Verify build
python -c "from director.entrypoint.main import app; print('OK')"
```

The Render service is `docker`-based. When you push to the `develop` branch, Render automatically rebuilds the Docker image using `apps/director/backend/Dockerfile`.

### 2.2 Build Director Frontend

```bash
cd apps/director/frontend

# Install dependencies
npm install

# Build
npm run build

# Preview production build locally (optional)
npx vite preview --port 4173
```

Render handles this automatically on branch push (Docker-based). Ensure the Dockerfile passes `VITE_APP_BACKEND_URL`.

### 2.3 Build VideoAgent Backend (Node) — directorProxy.js

The Node backend ships the Director proxy. No separate build step is required (it is run as `node server.js`).

```bash
cd backend
npm install
# Verify Lint and syntax
npx eslint services/directorProxy.js services/agentActionsService.js services/videoDbProxy.js
node --check services/directorProxy.js services/agentActionsService.js services/videoDbProxy.js
```

---

## 3. Migration Commands

### 3.1 Prisma/Drizzle MIGRATIONS (if applicable)
This repo uses raw PostgreSQL via a Render-managed database. Alembic manages Director backend migrations.

```bash
# Deploy-time (inside Render Docker)
cd apps/director/backend
PYTHONPATH=. alembic upgrade head --x env=production
```

### 3.2 Raw SQL Migrations (fallback)
If no migration framework is active, apply SQL directly:

```bash
# Get connection string from Render dashboard for director-db
psql "$DATABASE_URL" \
     -f apps/director/backend/director/migrations/create_tables.sql \
     -f apps/director/backend/director/migrations/add_indexes.sql
```

---

## 4. Rollback Procedure

A rollback is triggered if any metric in the rollback trigger table (see §6) is breached, or if critical Director endpoints return errors.

**Rollback the Director Backend:**
```bash
# Verify what version is currently deployed
curl -s "https://director-backend.onrender.com/health" | jq .
git log --oneline HEAD~3..HEAD     # review recent changes

# Revert and redeploy the director-backend
cd apps/director/backend
git revert <commit-hash>            # or git checkout <last-known-good>
git push origin staging             # or trigger Render manual deploy from UI

# Confirm rollback
curl -s "https://director-backend.onrender.com/health" | jq .
curl -s "https://director-backend.onrender.com/health" | jq .
```

**Rollback the Director Frontend:**
```bash
# If the frontend container is the issue, trigger a redeploy from Render UI
# using the previous Docker image tag, or queue a revert:
cd apps/director/frontend
git revert <commit-hash>
git push origin staging

# Render automatically builds; confirm
curl -s "https://director-frontend.onrender.com" | head
```

**Rollback the VideoAgent Backend (if directorProxy.js is at fault):**
```bash
cd backend
git revert <commit-hash>
git push origin staging

# Or use Render UI -> Manual Deploy with the previous image
```

**Emergency kill-switch (disable Director feature via env):**
```bash
# On director-frontend Render service
render env set VITE_ENABLE_DIRECTOR=false   # director-frontend
# Re-deploy; the frontend will hide the Director page
```

---

## 5. Post-Deploy Smoke Test Commands

Run these in order after each service finishes deploying.

```bash
# Configuration — replace with your actual staging URLs
BACKEND="https://videoagent-backend.onrender.com"
DIRECTOR_BE="https://director-backend.onrender.com"
DIRECTOR_FE="https://director-frontend.onrender.com"

echo "=== 1. VideoAgent Backend health ==="
curl -s -o /dev/null -w "HTTP %{http_code} | %{time_total}s\n" "$BACKEND/health"
# Expected: HTTP 200 in < 500ms

echo ""
echo "=== 2. Director Backend health ==="
curl -s -o /dev/null -w "HTTP %{http_code} | %{time_total}s\n" "$DIRECTOR_BE/health"
# Expected: HTTP 200 in < 500ms

echo ""
echo "=== 3. Director Frontend root ==="
curl -s -o /dev/null -w "HTTP %{http_code} | %{time_total}s\n" "$DIRECTOR_FE/"
# Expected: HTTP 200 in < 1s

echo ""
echo "=== 4. Agent actions (list 45 agents) ==="
curl -s "$BACKEND/api/agents/actions" -H "Authorization: Bearer $STAGING_JWT" | jq '.actions | length'
# Expected: 45

echo ""
echo "=== 5. Agent-actions health sub-endpoint ==="
curl -s -o /dev/null -w "HTTP %{http_code}" "$BACKEND/api/agents/health"
# Expected: HTTP 200

echo ""
echo "=== 6. VideoDB proxy health ==="
curl -s "$BACKEND/api/videodb/health"
# Expected: JSON with `{status: "ok", ...}` or similar; not 500

echo ""
echo "=== 7. Director agent proxy — ping a known agent (e.g. screenwriter) ==="
curl -s -X POST "$BACKEND/api/director/agent/screenwriter" \
  -H "Authorization: Bearer $STAGING_JWT" \
  -H "Content-Type: application/json" \
  -d '{"input":"test","videoId":"test_123"}' | jq .
# Expected: HTTP 200 with { ok: true } OR a 502 with a structured error
# (502 is acceptable if VIDEO_DB_API_KEY is not yet configured on director-backend)

echo ""
echo "=== 8. Verify /director page loads (from frontend) ==="
curl -s -o /dev/null -w "HTTP %{http_code} | %{time_total}s\n" "$DIRECTOR_FE/director"
# Expected: HTTP 200 in < 2s

echo ""
echo "=== 9. muapi-proxy — user-supplied key path ==="
# Send a request with a user key via the x-api-key header.
# The proxy should resolve to the user key and respond with x-key-source: user.
# (We use a deliberately-invalid key so upstream rejects with 401, NOT 500 —
# a 500 here would mean the proxy failed to extract the user key.)
curl -s -D - -o /tmp/muapi_user.json \
  -X POST "$BACKEND/api/muapi/test-endpoint" \
  -H "Authorization: Bearer $STAGING_JWT" \
  -H "Content-Type: application/json" \
  -H "x-api-key: muapi-test-user-key-not-real" \
  -d '{"input":"test"}' | grep -i "^x-key-source"
# Expected: x-key-source: user
# If missing or `x-key-source: server`, the proxy did not pick up the user header.

echo ""
echo "=== 10. muapi-proxy — missing user key ==="
# Same call with NO x-api-key header. Since there is no server-side fallback,
# the proxy should return HTTP 500 "No Muapi API key available".
curl -s -D - -o /tmp/muapi_missing.json \
  -X POST "$BACKEND/api/muapi/test-endpoint" \
  -H "Authorization: Bearer $STAGING_JWT" \
  -H "Content-Type: application/json" \
  -d '{"input":"test"}' | grep -i "No Muapi API key available"
# Expected: HTTP 500 with body containing "No Muapi API key available"
```

**Note on Authorization:** The staging environment requires a valid Supabase JWT (`$STAGING_JWT`). Obtain one by signing in to staging and copying the `Authorization` header from the browser DevTools Network tab.

---

## 6. Monitoring Links

| System | Link / Command | Notes |
|--------|---------------|-------|
| **Director Backend Logs** | Render Dashboard → `director-backend` → Logs | Primary debug source for FastAPI errors. Filter on `[director-proxy]` and `/api/director/`. |
| **Director Frontend Logs** | Render Dashboard → `director-frontend` → Logs | Vite SSR errors, build failures. |
| **VideoAgent Backend Logs** | Render Dashboard → `videoagent-backend` → Logs | Contains `[director-proxy]`, `[agent-actions]`, `[videodb-proxy]` log lines. |
| **Director-db (Postgres)** | Render Dashboard → `director-db` → psql / Query Editor | Check for migration errors or connection pool exhaustion. |
| **Error Tracking** | `VITE_SENTRY_DSN` → Sentry Dashboard (if configured) | Monitor Director frontend error rate. |
| **Performance / Metrics** | Render Dashboard → Metrics tab per service | Watch `response_time`, `cpu`, `memory`, `connections`. |
| **Rollback Trigger Table** | See §7 below | Monitor P95 latency, error rate, and user engagement. |
| **New Relic** | `newrelic.js` (existing in repo root) | Node backend APM already wired — confirm Agent is reporting. |

---

## 7. Rollback Trigger Table

| Metric | Hold | Rollback |
|--------|------|----------|
| Error rate | > 10% baseline (5-minute window) | > 2x baseline for ≥10 minutes |
| P95 latency | > 20% above baseline (5-minute window) | > 50% above baseline for ≥10 minutes |
| User reports | Any spike in support tickets mentioning Director | > 5% decline in Director page engagement vs. 24h prior |
| Error-tracking signal | > 5 Director-specific errors in Sentry per minute | > 50 Director errors in Sentry per minute |

**Response to a rollback trigger:**
1. Announce the incident in the team Slack channel.
2. Pause new deployments to `director-backend`, `director-frontend`, and `videoagent-backend`.
3. Execute the rollback procedure in §4 for the affected service(s).
4. File a post-mortem within 48 hours.

---

## 8. Rollback Trigger Table (Summary)

| Metric | Hold | Rollback |
|--------|------|----------|
| Error rate | > 10% baseline | > 2x baseline |
| P95 latency | > 20% baseline | > 50% baseline |
| User reports | Any spike | > 5% decline in engagement |

---

## 9. Security Notes

- **SSRF Protection**: `agentActionsService.js:validateFetchUrl()` blocks `localhost`, `127.0.0.1`, `169.254.169.254`, `0.0.0.0`, `::1`, and all RFC 1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`). Any outbound fetch made by agent actions enforces `https://` only.
- **Rate Limiting**: 
  - `/api/agents` → 20 req/min per IP
  - `/api/videodb` → 30 req/min per IP
  - `/api/director/agent/:id` → inherits the `/api/agents` limiter (mounted under `/api/agents` in `director-proxy.js`)
- **No Stack Traces in Errors**: All error responses use structured `{ ok: false, error: "…" }` bodies. Raw `err.stack` is never emitted to clients.
- **Server-side Keys Never Logged**: `videoDbKey`, `OPENAI_API_KEY`, and `SUPABASE_SERVICE_KEY` are read from the request body but never written to `console.log`.

---

## 10. Troubleshooting

### 10.1 All `muapi-proxy` requests return 500 `"No Muapi API key available"`

This means the proxy resolved **no** key in the extraction order (`body.muapi_api_key` → `body.params.muapi_api_key` → `x-api-key` header). The only cause is the user has not set a Muapi key.

**Fix:** Instruct the user to open the Settings modal and enter their Muapi API key. The key is persisted in `localStorage` and sent as the `x-api-key` header on every `muapi-proxy` request.

If a real `x-api-key` header was attached but the proxy still returned 500, the header is not reaching the function. Check:
- Browser `localStorage` for the `muapi` key slot (Settings modal → "Muapi API Key").
- CORS — the editor frontend origin must be allow-listed in the Supabase function.
- Whether a corporate proxy or browser extension is stripping the `x-api-key` header.

Confirm by running smoke test §5.9 with a known header value; you should see `x-key-source: user` in the response.

### 10.2 `x-key-source: user` but upstream returns 401

The proxy correctly forwarded the user key, but `api.muapi.ai` rejected it. Action: ask the user to verify their key in the Settings modal — common causes are a revoked/expired key, a typo, or a key from a different provider (the prefix should be `muapi-...`).

### 10.3 User has not set a Muapi key

**User-facing error path:** When a user attempts to use a Muapi-powered feature (e.g., stock footage search, image generation) without having configured a key in Settings, the `muapi-proxy` Supabase Edge Function returns HTTP 500:

```json
{ "error": "No Muapi API key available" }
```

The frontend surfaces this to the user as a prompt to open the Settings modal and enter their `muapi-...` key. There is no server-side fallback; the request cannot proceed without a user-supplied key.
