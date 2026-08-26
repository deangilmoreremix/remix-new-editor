# OpenThorn Production Readiness Checklist

## Current Status: DEV COMPLETE / PRODUCTION INCOMPLETE

### ✅ Completed
- [x] OpenThorn added as git subtree at `apps/openthorn`
- [x] OpenThorn dependencies installed
- [x] OpenThorn client bundle builds successfully
- [x] Iframe wrapper component created (`src/components/OpenThornStudio.js`)
- [x] Router integration complete (`openthorn` route, loader, auth gate)
- [x] Studio routes and landing page data registered
- [x] Dev CSP updated for `localhost:5173` iframe embedding

### ❌ Required for Production

#### 1. Build & Asset Serving
- [ ] Build OpenThorn: `cd apps/openthorn && npm run build`
- [ ] Copy `apps/openthorn/dist/` contents to `public/openthorn/`
- [ ] **OR** configure hosting to serve `/openthorn/*` from the subtree's built assets
- [ ] Ensure `public/openthorn/` is gitignored or generated during CI/CD

#### 2. Real Environment Variables
- [ ] Replace placeholder values in `apps/openthorn/.env` with real credentials:
  - `VITE_SUPABASE_URL` - Supabase project URL
  - `VITE_SUPABASE_ANON_KEY` - Supabase anon key
  - `SUPABASE_URL` - Same as above, server-side
  - `SUPABASE_ANON_KEY` - Same as above, server-side
  - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
  - `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID
  - `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Pages:Edit
  - `KEY_ENCRYPTION_SECRET` - 48-byte random secret for AES-256-GCM
  - `SUPABASE_OAUTH_CLIENT_ID` - Optional, for BYO-Supabase
  - `SUPABASE_OAUTH_CLIENT_SECRET` - Optional, for BYO-Supabase
  - `UPSTASH_REDIS_REST_URL` - Optional, for rate limiting
  - `UPSTASH_REDIS_REST_TOKEN` - Optional, for rate limiting
- [ ] Add these to your hosting platform's environment variables (Vercel/Netlify/etc.)
- [ ] **Never commit real secrets to git** - use platform env vars or a secrets manager

#### 3. Production CSP & Framing
- [ ] Remove `http://localhost:5173` and `ws://localhost:5173` from production CSP
- [ ] Add your actual production OpenThorn domain(s) to `frame-src` and `connect-src`
  - If serving from same origin `/openthorn/`, `frame-src 'self'` is sufficient
  - If using a subdomain like `openthorn.yourdomain.com`, add that domain
- [ ] Review `X-Frame-Options` header - currently `SAMEORIGIN` in production, which is correct for same-origin embedding
- [ ] Test CSP in production build: `npm run build && npm run preview`

#### 4. CI/CD Pipeline
- [ ] Add build step for OpenThorn subtree in your deployment pipeline
- [ ] Copy OpenThorn `dist/` to `public/openthorn/` before parent app build
- [ ] Example CI step:
  ```bash
  cd apps/openthorn
  npm ci --production=false
  npm run build
  rm -rf ../public/openthorn
  cp -r dist ../public/openthorn
  cd ..
  npm run build
  ```
- [ ] Ensure environment variables are available in CI for OpenThorn build

#### 5. Subtree Maintenance
- [ ] Document subtree update command:
  ```bash
  git subtree pull --prefix=apps/openthorn https://github.com/deangilmoremix/OpenThorn.git master --squash
  ```
- [ ] Set up periodic sync strategy (manual, scheduled, or via Dependabot)
- [ ] Test upstream changes in a branch before merging to main

#### 6. Testing
- [ ] Test OpenThorn studio route in production build locally: `npm run build && npm run preview`
- [ ] Verify iframe loads correctly from `/openthorn/` path
- [ ] Test authentication flow if using Clerk with OpenThorn
- [ ] Test actual AI provider connections with real API keys
- [ ] Test Cloudflare Pages deploy functionality
- [ ] Test on actual production domain, not just localhost

#### 7. Security & Compliance
- [ ] Verify OpenThorn's AES-256-GCM encryption is working with real `KEY_ENCRYPTION_SECRET`
- [ ] Review OpenThorn's RLS policies in Supabase match your security requirements
- [ ] Ensure provider API keys are never exposed to the client
- [ ] Review OpenThorn's CSP and security headers
- [ ] Verify rate limiting is configured for production

#### 8. Optional Enhancements
- [ ] Add loading state/spinner while OpenThorn iframe loads
- [ ] Add error boundary for iframe load failures
- [ ] Consider postMessage communication between parent app and OpenThorn
- [ ] Add OpenThorn to your app's main navigation/sidebar
- [ ] Style the iframe header to match your app's branding
- [ ] Add OpenThorn thumbnail/icon to studio picker

## Quick Start to Production

1. **Configure secrets:**
   ```bash
   cd apps/openthorn
   cp .env.example .env
   # Edit .env with real values
   ```

2. **Build and test locally:**
   ```bash
   cd apps/openthorn && npm run build
   rm -rf ../public/openthorn
   cp -r dist ../public/openthorn
   cd .. && npm run build && npm run preview
   ```

3. **Visit:** `http://localhost:4173/?#/openthorn` (or your preview port)

4. **Deploy:** Ensure CI/CD runs the build steps above before deploying parent app
