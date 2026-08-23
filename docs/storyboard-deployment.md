# Storyboard Studio — Deployment Guide

> Covers deploying the backend, the `muapi-proxy` Supabase Edge Function, and
> running the frontend end-to-end.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Variables](#2-environment-variables)
3. [Deploy the Backend](#3-deploy-the-backend)
4. [Deploy the muapi-proxy Edge Function](#4-deploy-the-muapi-proxy-edge-function)
5. [Run the Frontend](#5-run-the-frontend)
6. [Test the Complete Flow](#6-test-the-complete-flow)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

| Tool | Minimum version | Purpose |
|------|----------------|---------|
| **Node.js** | 20.x LTS | Backend server and Vite dev/build |
| **npm** | 10.x | Package management |
| **Supabase CLI** | 1.x+ | Deploying Edge Functions |
| **Supabase account** | — | Project for Edge Functions + Auth |
| **MuAPI account** | — | Stock footage and image generation API |
| **OpenAI account** | — | AI-assisted storyboard features (optional) |
| **Git** | any | Source control |
| **Clerk account** (optional) | — | User authentication |

Install the Supabase CLI:

```bash
npm install -g supabase
supabase login
```

---

## 2. Environment Variables

### 2.1 Backend (`backend/.env.local` or platform env vars)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | Yes | `development` or `production` | `dev-bypass` is only active when `development` |
| `PORT` | No | `4000` | Backend listen port |
| `SUPABASE_URL` | Yes (prod) | `https://xxx.supabase.co` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Recommended | `eyJ...` | Sent as `apikey` on outbound auth calls |
| `SUPABASE_SERVICE_KEY` | Optional | `eyJ...` | Used instead of anon key for server-side auth calls |
| `DEV_BYPASS_SECRET` | Dev only | `local-dev-only` | Secret for the `x-dev-bypass` header. **Never set in production.** |
| `OPENAI_API_KEY` | Yes (for AI features) | `sk-...` | Server-side fallback; users can override per-request |
| `MUAPI_API_KEY` | No | `muapi-...` | Server-side fallback; users should supply their own key |
| `VIDEO_DB_API_KEY` | Conditional | `vdbt-...` | Required if agent actions use VideoDB |
| `AUTH_VERIFY_TIMEOUT_MS` | No | `5000` | Timeout for Supabase JWT verification (ms) |

### 2.2 Supabase Edge Functions (`supabase/.env` or `supabase secrets set`)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `eyJ...` | Set via `supabase secrets set` |
| `APP_ORIGIN` | Yes (prod) | `https://app.example.com` | Frontend origin for CSRF defense-in-depth |
| `ALLOW_UNAUTHENTICATED` | Yes (prod, must be `false`) | `false` | Must be `false` in production. Set `true` only for local dev. |
| `OPENAI_API_KEY` | Conditional | `sk-...` | Server-side fallback for muapi-proxy OpenAI path |
| `SUPABASE_ENV` | No | `production` | Disables CORS wildcard fallbacks when `production` |

### 2.3 Frontend (`.env` or platform env vars)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `VITE_SUPABASE_URL` | Yes | `https://xxx.supabase.co` | Public Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | `eyJ...` | Supabase anon key (safe for browser) |
| `VITE_BACKEND_URL` | Yes | `http://localhost:4000` | URL of the Node backend |
| `VITE_DEV_BYPASS_AUTH` | **Dev only** | `true` | **Must NOT be set in production.** Hard-disabled when `MODE === 'production'`. |
| `VITE_ENABLE_ANALYTICS` | No | `false` | Enables client-side analytics calls |
| `VITE_ENABLE_ERROR_TRACKING` | No | `false` | Set `true` + `VITE_SENTRY_DSN` for error tracking |
| `VITE_SENTRY_DSN` | Conditional | `https://...` | Required if `VITE_ENABLE_ERROR_TRACKING=true` |

> ⚠️ **Production security:** Never set `DEV_BYPASS_SECRET` on the backend or
> `VITE_DEV_BYPASS_AUTH` on the frontend in production. Both are hard-disabled
> when `NODE_ENV === 'production'` / `import.meta.env.MODE === 'production'`.

---

## 3. Deploy the Backend

The backend is a Node.js/Express server. Deploy to any Node-capable host
(Render, Fly.io, Railway, etc.).

### 3.1 Local development

```bash
# From the repo root:
cp backend/.env.example backend/.env.local   # if an example exists
# Edit backend/.env.local with your values

# Install dependencies
cd backend && npm install && cd ..

# Start backend
PORT=4000 NODE_ENV=development node backend/server.js
# Confirm: curl http://localhost:4000/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 3.2 Render (production)

1. Connect the repo to Render and create a new **Web Service**.
2. Set the root directory to `backend/`.
3. Set the start command to `node server.js`.
4. Add the environment variables from §2.1 via the Render dashboard or
   `render env set`.
5. Ensure `NODE_ENV=production` is set.
6. Deploy from your target branch (e.g. `main` or `staging`).

```bash
# Verify health after deploy:
curl -s https://your-backend.onrender.com/health
# Expected: HTTP 200, {"status":"ok",...}
```

### 3.3 Verify deployed backend

```bash
BACKEND="https://your-backend.onrender.com"

curl -s -o /dev/null -w "HTTP %{http_code}\n" "$BACKEND/health"
# Expected: HTTP 200

curl -s "$BACKEND/api/storyboard/health-check" | head
# (storyboard routes are unauthenticated; returns 200 or 404 for missing IDs)
```

---

## 4. Deploy the muapi-proxy Edge Function

The `muapi-proxy` is a Supabase Edge Function that proxies MuAPI requests from
the frontend, adding server-side security (origin checks, rate limiting, key
extraction).

### 4.1 Prerequisites

- A Supabase project (free tier is sufficient for development)
- Supabase CLI installed and authenticated
- The function source at `supabase/functions/muapi-proxy/`

### 4.2 Link to your Supabase project

```bash
cd supabase
supabase link --project-ref <your-project-ref>
```

Find your project ref in the Supabase dashboard: Settings → General → Reference ID.

### 4.3 Set secrets

```bash
supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  --project-ref <your-project-ref>

# Only needed for production:
supabase secrets set \
  APP_ORIGIN="https://your-frontend.com" \
  ALLOW_UNAUTHENTICATED="false" \
  OPENAI_API_KEY="sk-..." \
  --project-ref <your-project-ref>
```

### 4.4 Deploy the function

```bash
supabase functions deploy muapi-proxy --project-ref <your-project-ref>
```

Expected output:
```
Deploying function muapi-proxy (https://<ref>.supabase.co/functions/v1/muapi-proxy)
```

### 4.5 Verify the deployment

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  "https://<ref>.supabase.co/functions/v1/muapi-proxy/health"
# Expected: HTTP 200 (or 404 if /health is not implemented — acceptable)
```

### 4.6 CORS configuration

The `muapi-proxy` function enforces CORS. In production (`SUPABASE_ENV=production`)
it rejects origins not in the allow-list. Confirm the frontend origin is allowed
by checking the function's CORS response headers:

```bash
curl -s -D - -o /dev/null \
  -X OPTIONS "https://<ref>.supabase.co/functions/v1/muapi-proxy/test" \
  -H "Origin: https://your-frontend.com" \
  -H "Access-Control-Request-Method: POST" \
  | grep -i access-control-allow-origin
# Expected: https://your-frontend.com
```

---

## 5. Run the Frontend

The frontend is a Vite + React application.

### 5.1 Install dependencies

```bash
npm install
```

### 5.2 Configure environment

Create `.env` in the project root (or set env vars in your platform):

```env
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_BACKEND_URL=http://localhost:4000
```

> In production, `VITE_BACKEND_URL` should point to your deployed backend URL
> (e.g. `https://your-backend.onrender.com`).

### 5.3 Start the dev server

```bash
npm run dev
# Vite dev server starts at http://localhost:3000
```

### 5.4 Build for production

```bash
npm run build
# Output: dist/
```

Deploy `dist/` to your static host (Vercel, Netlify, Cloudflare Pages, Render
Static Site, etc.). Ensure the platform injects the same env vars at build time.

### 5.5 Verify frontend loads

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
# Expected: HTTP 200
```

---

## 6. Test the Complete Flow

### 6.1 Automated backend tests

```bash
# Terminal 1 — start backend
PORT=4000 NODE_ENV=development node backend/server.js

# Terminal 2 — run the API test script
node test-storyboard-apis.mjs
```

Expected output:
```
✅ backend health
✅ storyboard create
✅ storyboard read
✅ storyboard update
✅ storyboard delete
✅ storyboard 404 after delete
✅ dev bypass auth header
✅ comparison agent starts
✅ comparison agent completes
✅ storyboard agent starts
✅ storyboard agent completes
```

Set `OPENAI_API_KEY` for the full AI test:

```bash
OPENAI_API_KEY=sk-... node test-storyboard-apis.mjs
```

### 6.2 Test with a real Supabase JWT

To verify the production auth path (bypassing dev bypass):

```bash
# 1. Sign in to the frontend at http://localhost:3000
# 2. Open DevTools → Network tab
# 3. Find a backend request (e.g. /api/storyboard/...)
# 4. Copy the Authorization header value
# 5. Run:
SUPABASE_JWT="<copied-token>" node test-storyboard-apis.mjs
```

Or obtain a JWT directly from Supabase Auth:

```bash
curl -X POST "https://<ref>.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"your-password"}'
# Copy the "access_token" field → export SUPABASE_JWT="<token>"
```

### 6.3 Frontend smoke test

Open http://localhost:3000/storyboard and verify the checklist in
`test-storyboard-apis.mjs` section 9.

Key flows to test manually:

| Flow | Steps |
|------|-------|
| **Generate frame** | Select model → enter prompt → click Generate Frame → image appears |
| **Batch generate** | Add 3+ frames → click Generate All → progress updates per frame |
| **Retry** | After a failed generation, click Retry Failed |
| **Save/Load** | Click Save → reload page → click Load → frames restore |
| **Export** | Click Export PDF → print dialog opens with all frames |
| **Undo/Redo** | Delete a frame → Ctrl+Z → Ctrl+Y |
| **Comparison** | Select two frames → click Compare → analysis modal opens |

### 6.4 muapi-proxy smoke test

```bash
SUPABASE_REF="<your-project-ref>"
ANON_KEY="<your-anon-key>"

# 1. Health
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  "https://${SUPABASE_REF}.supabase.co/functions/v1/muapi-proxy/health"

# 2. User-key path — use a real MuAPI key
curl -s -D - -o /tmp/muapi_test.json \
  -X POST "https://${SUPABASE_REF}.supabase.co/functions/v1/muapi-proxy/test" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "x-api-key: <your-real-muapi-key>" \
  -d '{"input":"a red apple on a wooden table"}' | grep -i "^x-key-source"
# Expected: x-key-source: user

# 3. Missing key — should return 500
curl -s -D - -o /tmp/muapi_missing.json \
  -X POST "https://${SUPABASE_REF}.supabase.co/functions/v1/muapi-proxy/test" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"input":"test"}' | grep -i "No Muapi API key"
# Expected: HTTP 500 with "No Muapi API key available"

# 4. Rate limit — 6th request should return 429
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w "req $i: HTTP %{http_code}\n" \
    -X POST "https://${SUPABASE_REF}.supabase.co/functions/v1/muapi-proxy/test" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "x-api-key: <your-real-muapi-key>" \
    -H "Content-Type: application/json" \
    -d '{"input":"test"}'
done
# Expected: req 6: HTTP 429
```

---

## 7. Troubleshooting

### 7.1 `401 Unauthorized` on authenticated endpoints

**Cause:** Missing or invalid `Authorization: Bearer <token>` header, or the
dev bypass is not active.

**Fixes:**
- Development: ensure `NODE_ENV=development` and `x-dev-bypass: local-dev-only`
  (or your custom `DEV_BYPASS_SECRET`) are set.
- Production: obtain a valid Supabase JWT and pass it as the `Authorization` header.
- Verify `SUPABASE_URL` is set — without it, the backend cannot verify any token.

### 7.2 `500 "No Muapi API key available"` from muapi-proxy

**Cause:** The proxy found no key in its extraction order
(`body.muapi_api_key` → `body.params.muapi_api_key` → `x-api-key` header).

**Fixes:**
- In the frontend Settings modal, enter a valid `muapi-...` key.
- Confirm the key is saved in `localStorage` under the Muapi provider slot.
- Check that the `x-api-key` header is reaching the Edge Function (check
  Supabase function logs).
- Ensure a corporate proxy or browser extension is not stripping the header.

### 7.3 `x-key-source: user` but upstream returns 401

The proxy forwarded the user key correctly, but MuAPI rejected it.

**Fix:** Verify the key in Settings — it may be revoked, expired, or a typo.
The key prefix should be `muapi-...`.

### 7.4 CORS errors from muapi-proxy

**Cause:** The frontend origin is not in the Edge Function's allow-list.

**Fixes:**
- Set `APP_ORIGIN` to exactly match the frontend URL (including `https://` and
  no trailing slash).
- In development, set `SUPABASE_ENV=development` (or omit it) to allow the
  localhost origin.
- Verify the `Access-Control-Allow-Origin` response header matches the
  `Origin` request header.

### 7.5 Storyboard frames not persisting

**Cause:** The backend `/api/storyboard` routes are unauthenticated. If the
backend is unreachable, the frontend falls back to `localStorage`.

**Fixes:**
- Confirm `VITE_BACKEND_URL` points to the correct backend address.
- Check the browser console for CORS or network errors.
- Verify the backend is running: `curl $VITE_BACKEND_URL/health`.

### 7.6 Comparison agent returns 500 "An OpenAI API key is required"

The `comparison` agent uses OpenAI Responses API. The backend needs a key.

**Fixes:**
- Set `OPENAI_API_KEY` in the backend environment.
- Or pass `settings.apiKey` in the request body from the frontend Settings modal.

### 7.7 Rate limiting (HTTP 429) during development

**Cause:** Too many requests in the rate-limit window.

**Rate limits:**
- `/api/agents` → 20 req/min per IP
- `/videoagent` → 10 req/min per IP
- `/api/videodb` → 30 req/min per IP

**Fix:** Wait for the window to reset (60 seconds) or request a higher limit.

### 7.8 Supabase auth verification timeout

If `SUPABASE_URL` is reachable but JWT verification is slow, you may see
`Supabase auth timed out after 5000ms`.

**Fix:** Increase the timeout: `AUTH_VERIFY_TIMEOUT_MS=10000`.

### 7.9 Backend logs not showing dev bypass events

If the dev bypass should be active but you see 401s:
- Confirm `NODE_ENV=development` is set in the terminal or process manager.
- Confirm the `x-dev-bypass` header value matches `DEV_BYPASS_SECRET` exactly.
- Look for `auth.dev_bypass` in the backend logs (it logs at `info` level).
