# Brand Studio Integration Plan

## Executive Summary
Brand Studio is a new studio module inside smartvid.app. It does not need its own authentication; it should inherit the existing Clerk session and Supabase backend already provided by smartvid.app. The remaining work is to make Brand Studio a first-class citizen in the studio ecosystem: route integration, data sync, studio-to-studio handoff, and persistence hardening.

## Current State

### What Works
- Brand Studio routes are registered: `brand`, `brand-dna`, `campaign`, `asset-edit`, `photo-studio`, `brand-photo-studio`, `animate`, `campaign-page`
- All 6 pages render and make API calls with the sandbox muapi key
- Persistence exists via `src/lib/brandStore.js` (localStorage + optional Supabase sync)
- Tests pass: 6/6 page tests, 31/31 Brand Studio unit tests

### Gaps vs Established Studios
| Gap | Impact |
|---|---|
| No read-back from Supabase | Auth users lose content across devices |
| Backend stores are in-memory Maps | Server restart wipes campaigns/photoshoots |
| No studio-to-studio handoff | Cannot pass Brand DNA to Cinema/Animate/Upscale |
| Asset URLs are references only | No CDN or persistent media hosting |
| `apiCall` in Brand pages has no shared retry/timeout config | Inconsistent error handling vs other studios |
| No quota/usage telemetry | Users don't know generation limits |

**Auth assumption:** smartvid.app already provides Clerk auth + Supabase. Brand Studio should not add another auth layer. It should use the existing `window.Clerk` session and Supabase client directly.

---

## 1. Architectural Considerations

### 1.1 Route Integration
- Brand Studio routes already live in `src/lib/router.js` under the studio gate
- All 8 routes are in `STUDIO_PAGES` and require Clerk auth
- Navigation drawer (`mountStudioDrawer`) auto-discovers routes via `getGroupedStudioRoutes` — Brand Studio already appears in the studio menu

### 1.2 Shared Primitives
Brand Studio already uses:
- `mountStudioChrome` — consistent top bar + drawer
- `navigate` — shared router
- `showToast`, `createLoadingOverlay` — shared UX
- `apiCall` — but it bypasses the shared `apiClient` used by Cinema/Animate

### 1.3 Data Model Alignment
| Brand Store | Cinema/Animate equivalent |
|---|---|
| `brand_dna_list` | Project presets / templates |
| `brand_campaigns` | Timeline / storyboard |
| `brand_assets` | Media library assets |
| `brand_photoshoots` | Generated media |
| `brand_animations` | Generated clips |

The schema is already compatible enough to treat Brand DNA as a "style preset" that other studios can consume.

### 1.4 Auth Boundary
- Do not add Brand Studio–specific login/signup
- Do not duplicate Clerk checks
- Reuse `window.Clerk.user` for identity and `supabase` for persistence
- Use Clerk `user.id` as the canonical owner id for Supabase rows

---

## 2. Workflow Synchronization

### 2.1 Brand → Cinema / Animate / Upscale
When a user opens a non-Brand studio with a saved brand selected:
1. Read brand DNA from `listBrands()`
2. Inject brand colors, fonts, tone into the studio's generation prompt
3. Allow "Apply Brand Style" toggle in studio header

### 2.2 Cinema/Animate → Brand
When a user generates content in another studio:
1. Optionally extract style metadata back into Brand DNA
2. Update `imageryStyle`, `primaryColors`, `toneOfVoice` in the selected brand

### 2.3 Asset Pipeline
- Generated photo/video URLs currently point to muapi CDN or blob URLs
- Need a media-library registration step: `saveAsset({ ..., type: 'photo'|'video'|'image' })`
- Other studios should read from `listAssets()` to surface Brand Studio outputs

---

## 3. Resource Allocation

### 3.1 Storage Budget
| Store | Current Limit | Recommended |
|---|---|---|
| `brand_dna_list` | 50 items | 50 items × ~5KB = 250KB |
| `brand_campaigns` | 200 items | 200 items × ~10KB = 2MB |
| `brand_assets` | 500 items | 500 items × ~2KB = 1MB |
| `brand_photoshoots` | 200 items | 200 items × ~3KB = 600KB |
| `brand_animations` | 200 items | 200 items × ~3KB = 600KB |
| **Total** | ~4.5MB | **~4.5MB** |

The existing 4MB safety limit in `safeSet` is tight. Recommendation: increase to 8MB or move large blobs to IndexedDB.

### 3.2 Supabase Tables
Already scoped in `brandStore.js`:
- `brand_dna`
- `campaigns`
- `assets`
- `photoshoots`
- `animations`

No schema changes needed; upsert pattern works.

### 3.3 MuAPI Quota
- Photo Studio: 1 muapi call per category/style pair (up to 30 per generation)
- Campaign: 1 text call for concepts + 1 image call per asset
- Brand extraction: 1 text call
- Recommendation: add per-user quota tracking in `brandStore.js` against Clerk `user.id`

---

## 4. Step-by-Step Implementation Roadmap

### Phase 1: Data Integrity (Week 1)
- [ ] Wire `listBrands()` to fall back to `fetchBrandsFromSupabase()` when authenticated
- [ ] Wire `listCampaigns()`, `listAssets()`, `listPhotoshoots()`, `listAnimations()` similarly
- [ ] Add `syncBrandFromSupabase` merge logic to avoid overwriting local edits
- [ ] Add conflict resolution: `updatedAt` timestamp comparison

### Phase 2: Studio Interop (Week 2)
- [ ] Add `useBrandPreset(brandId)` helper for non-Brand studios
- [ ] Inject brand colors/fonts into Cinema/Animate/Upscale prompt builders
- [ ] Add "Open in [Studio]" buttons in BrandDnaEditor header (already partially present)
- [ ] Register Brand assets in shared media library (`src/lib/editor/mediaLibrary.js`)

### Phase 3: Media Persistence (Week 3)
- [ ] Replace muapi blob URLs with persistent CDN references or Supabase Storage
- [ ] Add `uploadToSupabaseStorage(file)` helper
- [ ] Update `savePhotoshoot`, `saveAsset` to persist binary blobs
- [ ] Add lazy-load thumbnails for Brand Studio result grids

### Phase 4: Quota & Telemetry (Week 4)
- [ ] Add `brandQuota.js` tracking generations per user per day
- [ ] Surface quota in Brand Studio header
- [ ] Add webhook handler for muapi usage callbacks
- [ ] Log studio handoffs for funnel analysis

### Phase 5: Polish (Week 5)
- [ ] Add "Recent Brands" quick-pick in studio drawer
- [ ] Add Brand Studio entry point from Cinema/Animate "Style" dropdown
- [ ] Ensure all Brand Studio buttons use `mountStudioChrome` back-nav consistently
- [ ] E2E test: create brand → generate campaign → open in Cinema → verify style carryover

---

## 5. Risk Register

| Risk | Mitigation |
|---|---|
| Supabase not configured for all users | Keep localStorage-first; sync is best-effort |
| MuAPI key missing in other studios | Pass `brand.muapiKey` through studio handoff |
| 4MB localStorage limit exceeded | Move large payloads to IndexedDB or Supabase Storage |
| Server restart loses backend Maps | Migrate campaign/photo backends to SQLite or PostgreSQL |

---

## 6. Decision Log

- **Chose localStorage-first** because it works offline and requires no auth
- **Kept backend Maps** for now; migration to DB is out of scope for this integration
- **Did not merge Brand Studio into existing studios** — kept it separate to preserve its distinct workflow
- **Reused `mountStudioChrome`** rather than building custom chrome
- **No separate Brand Studio auth** — inherited from smartvid.app’s Clerk + Supabase stack

---

## 7. Open Questions

1. Should Brand DNA be editable inside Cinema/Animate, or only as a preset?
2. Do we want per-brand muapi key rotation, or one global key?
3. Should campaign assets be shared across users, or strictly private?
