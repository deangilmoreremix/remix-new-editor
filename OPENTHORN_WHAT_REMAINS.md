# OpenThorn Production Readiness Summary

## What Still Needs to Be Completed

### 🔴 Critical (Must Have Before Production)

#### 1. Real Environment Variables
**Current state:** `apps/openthorn/.env` contains placeholder values
**Required:** Replace with actual credentials

OpenThorn requires these real values:
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` - Supabase project
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key
- `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` - For deploying user sites
- `KEY_ENCRYPTION_SECRET` - 48-byte secret for AES-256-GCM encryption

**Where to set:**
- Local dev: `apps/openthorn/.env` (already exists, needs real values)
- Production: Set in your hosting platform's environment variables (Vercel/Netlify/Render)
- **Never commit real secrets to git**

#### 2. Production Build & Asset Serving
**Current state:** OpenThorn builds to `apps/openthorn/dist/` but is not yet served in production
**Required:** Build OpenThorn and make it available at `/openthorn/`

**Option A: Static copy (recommended for Vercel/Netlify)**
```bash
cd apps/openthorn && npm run build
rm -rf ../public/openthorn
cp -r dist ../public/openthorn
```

**Option B: CI/CD step**
The root `package.json` now has:
```bash
npm run build:openthorn
```
This builds OpenThorn and copies to `public/openthorn/` automatically.

**Note:** `public/openthorn/` is gitignored. It must be generated during each deployment.

#### 3. Production CSP Configuration
**Current state:** Dev CSP allows `localhost:5173` for local OpenThorn dev server
**Required:** Remove dev-only sources in production

The updated `vite.config.js` now conditionally includes localhost sources:
- Dev: allows `localhost:5173` for OpenThorn dev server
- Production: strips localhost sources automatically

**If using a custom domain for OpenThorn in production** (e.g., `openthorn.yourdomain.com`):
- Add that domain to `frame-src` and `connect-src` in the CSP
- Update `OPENTHORN_PROD_PATH` in `src/components/OpenThornStudio.js`

If serving from same origin (`/openthorn/`), no changes needed — `frame-src 'self'` is already correct.

### 🟡 Important (Should Have Soon)

#### 4. Subtree Update Workflow
**Created:** `scripts/update-openthorn-subtree.sh`
**Usage:**
```bash
./scripts/update-openthorn-subtree.sh master
```

This fetches latest from upstream and updates the subtree. You should:
- Run this periodically to pull upstream fixes
- Test changes in a branch before merging to main

#### 5. Production Validation
**Before deploying, verify:**
```bash
# 1. Build OpenThorn
cd apps/openthorn && npm run build

# 2. Copy to public
rm -rf ../public/openthorn && cp -r dist ../public/openthorn

# 3. Build parent app
cd .. && npm run build

# 4. Preview production build
npm run preview

# 5. Test OpenThorn route
# Visit: http://localhost:4173/?#/openthorn
```

#### 6. Authentication & Access Control
**Current state:** OpenThorn route is gated by `STUDIO_PAGES` set
**Required decision:** Should OpenThorn require pro plan, or be open to all users?

In `src/lib/router.js`, OpenThorn is in `STUDIO_PAGES`, which means:
- Non-authenticated users → redirected to `/signin`
- Authenticated free users → redirected to `/pricing` (requires pro plan)

**To make OpenThorn publicly accessible:**
1. Remove `'openthorn'` from `STUDIO_PAGES` in `src/lib/router.js`
2. Add explicit bypass in `ensureStudioAccess()`:
   ```javascript
   if (page === 'openthorn') return true;
   ```

### 🟢 Nice to Have (Post-Launch)

#### 7. UI Enhancements
- [ ] Add OpenThorn to main navigation sidebar (currently only in studio drawer)
- [ ] Add OpenThorn thumbnail to studio landing hub
- [ ] Add loading state while OpenThorn iframe initializes
- [ ] Add error boundary for iframe load failures
- [ ] Consider postMessage bridge for parent ↔ OpenThorn communication

#### 8. Observability
- [ ] Add iframe load time tracking
- [ ] Add error reporting for OpenThorn iframe failures
- [ ] Monitor OpenThorn API/deploy endpoints separately

#### 9. Documentation
- [ ] Document OpenThorn integration in main README
- [ ] Add troubleshooting guide for common iframe/CSP issues
- [ ] Document how to update OpenThorn subtree

## Files Changed

### New Files
- `apps/openthorn/` - OpenThorn git subtree
- `apps/openthorn/.env` - OpenThorn environment variables
- `src/components/OpenThornStudio.js` - Iframe wrapper component
- `scripts/update-openthorn-subtree.sh` - Subtree update script
- `OPENTHORN_PRODUCTION.md` - Detailed production checklist

### Modified Files
- `src/lib/router.js` - Added openthorn route, loader, auth gate
- `src/lib/studioRoutes.js` - Added OpenThorn to studio menu
- `src/data/studioLandingPages.js` - Added OpenThorn landing page
- `vite/config.js` - Updated CSP for OpenThorn iframe
- `package.json` - Added `build:openthorn` script
- `.gitignore` - Added `public/openthorn/`

## Quick Start to Production

```bash
# 1. Configure real secrets
cd apps/openthorn
cp .env.example .env
# Edit .env with real Supabase, Cloudflare, and encryption credentials

# 2. Build OpenThorn
npm run build

# 3. Copy to public folder
rm -rf ../public/openthorn
cp -r dist ../public/openthorn

# 4. Build parent app
cd .. && npm run build

# 5. Test locally
npm run preview
# Visit: http://localhost:4173/?#/openthorn

# 6. Deploy parent app
# The public/openthorn/ folder will be served at /openthorn/
```

## Next Immediate Step

**Configure real environment variables in `apps/openthorn/.env`** — this is the only hard blocker for a working production application. Everything else is infrastructure/pipeline.
