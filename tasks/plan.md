# Implementation Plan: Pexels API Integration

## Overview

Integrate the Pexels API into the existing video/image creation application to provide users with a searchable library of stock photos and videos. Users will be able to search, preview, and import Pexels media directly into their projects as assets or reference material.

## Architecture Decisions

- **Server-side proxy with server-owned Pexels key** to avoid exposing the API key in the browser and to centralize rate-limit management. User-supplied Pexels keys are supported as an optional override via Settings (mirroring the existing VideoDB hybrid pattern).
- **New Express service mounted at `/api/pexels`** in `backend/server.js`, following the same shape as `videoDbProxyService.js` and `directorProxy.js`.
- **Frontend media browser as a new page component** (`PexelsMediaPage.js`) and a reusable media browser widget, fitting the existing `ContentLibraryPage` / `LibraryPage` UI patterns.
- **Caching layer** using in-memory LRU cache on the backend (short TTL for search results) plus browser `sessionStorage` for recently viewed items to reduce redundant API calls.
- **Attribution enforced at the UI layer** so every imported asset carries its required credit metadata.

## Task List

### Phase 1: Backend Foundation

#### Task 1: Add Pexels environment configuration
**Description:** Add the Pexels API key to the environment configuration and document it.

**Acceptance criteria:**
- [ ] `PEXELS_API_KEY` added to `.env.example` with instructions
- [ ] Backend reads `PEXELS_API_KEY` from `process.env` with a clear startup warning if missing

**Verification:**
- [ ] `grep PEXELS_API_KEY .env.example` shows the new entry
- [ ] Backend starts without crashing when key is present

**Dependencies:** None

**Files likely touched:**
- `.env.example`

**Estimated scope:** XS

---

#### Task 2: Create Pexels proxy service
**Description:** Build `backend/services/pexelsProxyService.js` following the same router/retry patterns used by `videoDbProxyService.js` and `directorProxy.js`. The service will proxy search, curated, and detail endpoints for both photos and videos.

**Acceptance criteria:**
- [ ] Express router mounted at `/api/pexels`
- [ ] Endpoints: `GET /photos/search`, `GET /photos/curated`, `GET /photos/:id`, `GET /videos/search`, `GET /videos/popular`, `GET /videos/:id`
- [ ] Server-side key used by default; optional `x-pexels-api-key` header allows caller override
- [ ] `withRetry` wrapper (maxAttempts=2, baseDelay=500ms) on all outbound Pexels calls
- [ ] Response shapes match Pexels docs exactly so frontend code can consume them directly
- [ ] Rate-limit headers (`X-Ratelimit-Limit`, `X-Ratelimit-Remaining`, `X-Ratelimit-Reset`) forwarded to the client
- [ ] 429 responses propagate with a clear error message instead of crashing

**Verification:**
- [ ] `node backend/server.js` starts cleanly
- [ ] `curl -H "Authorization: Bearer $PEXELS_API_KEY" http://localhost:3001/api/pexels/photos/search?query=nature&per_page=2` returns valid JSON

**Dependencies:** Task 1

**Files likely touched:**
- `backend/services/pexelsProxyService.js` (new)
- `backend/server.js`

**Estimated scope:** M

---

#### Task 3: Register Pexels routes in server.js
**Description:** Wire the new service into the Express app with appropriate rate limiting and auth middleware.

**Acceptance criteria:**
- [ ] `pexelsProxyService` imported in `backend/server.js`
- [ ] Mounted at `/api/pexels` with `optionalAuth` (publicly browsable media search does not require a logged-in user)
- [ ] Rate limiter configured: 30 req/min per IP for search endpoints, 60 req/min for detail endpoints

**Verification:**
- [ ] Backend server starts without module errors
- [ ] `ab -n 35 -c 1 http://localhost:3001/api/pexels/photos/search?query=test` returns 429 on the 31st request

**Dependencies:** Task 2

**Files likely touched:**
- `backend/server.js`

**Estimated scope:** S

---

### Phase 2: Frontend Core

#### Task 4: Create Pexels API client helper
**Description:** Add a small frontend helper (`src/lib/pexelsApi.js`) that calls the backend proxy and normalizes responses. Include an in-memory + `sessionStorage` cache for search results.

**Acceptance criteria:**
- [ ] Helper functions: `searchPhotos`, `searchVideos`, `getPhoto`, `getVideo`, `getCuratedPhotos`, `getPopularVideos`
- [ ] All calls go to `/api/pexels/...` (never directly to `api.pexels.com` from the browser)
- [ ] Search results cached in `sessionStorage` keyed by query + filters for 5 minutes
- [ ] Cache hit returns instantly without network request
- [ ] Errors surface as thrown objects with `message` and optional `status`

**Verification:**
- [ ] `node --test` or equivalent test runner passes for the new module
- [ ] Manual test: search twice with same query, second call hits cache

**Dependencies:** Task 3

**Files likely touched:**
- `src/lib/pexelsApi.js` (new)

**Estimated scope:** S

---

#### Task 5: Build Pexels media browser page
**Description:** Create `src/components/PexelsMediaPage.js` as a full-page media browser. Follow the existing `ContentLibraryPage.js` and `LibraryPage.js` patterns (vanilla DOM, Tailwind classes, hero banner, filter tabs, search input, grid, preview overlay).

**Acceptance criteria:**
- [ ] Route registered in `src/lib/router.js` as `pexels-media` → `PexelsMediaPage`
- [ ] Hero banner with title "Stock Media" and subtitle
- [ ] Filter tabs: Photos, Videos, All
- [ ] Search input with debounced query (300ms)
- [ ] Responsive grid: 2 cols mobile, 3 cols tablet, 4 cols desktop
- [ ] Infinite scroll pagination using `next_page` URLs
- [ ] Loading skeleton while fetching
- [ ] Empty state when no results found
- [ ] Error toast with retry button on fetch failure

**Verification:**
- [ ] Navigating to the new route renders the page
- [ ] Searching "nature" loads photo results
- [ ] Switching to Videos tab loads video results
- [ ] Scrolling loads next page automatically

**Dependencies:** Task 4

**Files likely touched:**
- `src/components/PexelsMediaPage.js` (new)
- `src/lib/router.js`

**Estimated scope:** M

---

#### Task 6: Implement preview modal
**Description:** Add a reusable preview overlay component that displays full-size media with attribution details and an "Import" button.

**Acceptance criteria:**
- [ ] Clicking a grid item opens the preview overlay (fixed inset-0, dark backdrop)
- [ ] Photos display the `large2x` or `original` src with aspect-ratio containment
- [ ] Videos display the `image` thumbnail with a play button overlay; clicking opens the actual video in a `<video>` element with controls
- [ ] Attribution panel shows: photographer/videographer name, Pexels profile link, Pexels content link
- [ ] "Import to Project" button that emits a custom event (`pexels:import`) with the full media object
- [ ] Close on backdrop click or Escape key
- [ ] Keyboard accessible: Tab trapped inside modal while open

**Verification:**
- [ ] Open preview, verify photo renders at full quality
- [ ] Open video preview, verify play/pause works
- [ ] Verify attribution text is present and links are clickable
- [ ] Verify Escape closes the modal

**Dependencies:** Task 5

**Files likely touched:**
- `src/components/PexelsMediaPage.js` (extend existing preview overlay)

**Estimated scope:** M

---

#### Task 7: Wire import into project workflow
**Description:** When a user clicks "Import to Project", add the media to the active project's asset library or timeline. Mirror the existing `UploadPicker` and `contentLibrary` patterns.

**Acceptance criteria:**
- [ ] Import action calls `saveContentLibraryEntry` (or equivalent) with Pexels metadata
- [ ] Stored fields: `type` (`image` or `video`), `src` (selected Pexels URL), `thumb`, `width`, `height`, `duration` (video), `attribution` (photographer name + URL), `pexelsId`, `source: 'pexels'`
- [ ] After import, show a success toast and close the preview
- [ ] Imported media appears in the user's Library page with a "Pexels" badge

**Verification:**
- [ ] Import a photo, refresh Library page, photo appears
- [ ] Import a video, verify it appears in video filter
- [ ] Attribution persists after reload

**Dependencies:** Task 5, Task 6

**Files likely touched:**
- `src/components/PexelsMediaPage.js`
- `src/lib/contentLibrary.js` (extend schema if needed)

**Estimated scope:** M

---

### Phase 3: Settings & User Preferences

#### Task 8: Add Pexels API key to Settings
**Description:** Allow power users to supply their own Pexels API key, following the same pattern as `ApiKeyManager` for OpenAI/VideoDB.

**Acceptance criteria:**
- [ ] Settings UI gains a "Pexels API Key" field
- [ ] Key stored via `ApiKeyManager` with kind `pexels`
- [ ] Backend proxy reads user-supplied key from `x-pexels-api-key` header and uses it instead of the server key
- [ ] Validation: key must start with a recognizable prefix or be at least 20 chars
- [ ] "Test Connection" button that calls `/api/pexels/photos/search?query=test&per_page=1` and reports success/failure

**Verification:**
- [ ] Enter a valid Pexels key, save, reload — key persists
- [ ] Enter an invalid key, test connection returns error toast
- [ ] With user key set, backend uses it (verify via request logs)

**Dependencies:** Task 2

**Files likely touched:**
- `src/lib/apiKeyManager.js`
- `src/components/SettingsPage.jsx` (or equivalent)
- `backend/services/pexelsProxyService.js`

**Estimated scope:** M

---

### Phase 4: Optimization & Scaling

#### Task 9: Implement backend caching layer
**Description:** Add an in-memory LRU cache to `pexelsProxyService` to reduce redundant Pexels API calls for identical queries.

**Acceptance criteria:**
- [ ] Cache key: `method + url + query string`
- [ ] TTL: 300 seconds for search endpoints, 600 seconds for curated/popular, 3600 seconds for detail endpoints
- [ ] Max cache entries: 500
- [ ] Stale-while-revalidate: return cached response immediately, refresh in background if expired
- [ ] `Cache-Control` response headers set to `public, max-age=TTL` so CDN/edge can cache too
- [ ] Logging: cache hit/miss rates logged per requestId for observability

**Verification:**
- [ ] Same search query twice within TTL returns instantly (check response time)
- [ ] After TTL expires, background refresh triggers
- [ ] Cache stats visible in logs

**Dependencies:** Task 2

**Files likely touched:**
- `backend/services/pexelsProxyService.js`

**Estimated scope:** M

---

#### Task 10: Implement rate-limit awareness and graceful degradation
**Description:** Use the `X-Ratelimit-Remaining` header from Pexels to warn users and disable non-essential search when quota is low.

**Acceptance criteria:**
- [ ] Backend parses `X-Ratelimit-Remaining` and `X-Ratelimit-Reset` on every successful Pexels response
- [ ] When remaining < 50, frontend shows a subtle banner: "Pexels API quota running low"
- [ ] When remaining = 0, frontend disables search and shows: "Pexels quota exhausted. Please try again later or add your own API key in Settings."
- [ ] Server logs a warning when remaining < 20
- [ ] Server rejects non-essential proactive requests (e.g., pre-fetching curated photos) when remaining < 10

**Verification:**
- [ ] Simulate low quota via mock, verify banner appears
- [ ] Simulate zero quota, verify search is disabled

**Dependencies:** Task 2, Task 4

**Files likely touched:**
- `backend/services/pexelsProxyService.js`
- `src/lib/pexelsApi.js`
- `src/components/PexelsMediaPage.js`

**Estimated scope:** M

---

#### Task 11: Add video download and transcoding guardrails
**Description:** Videos from Pexels are hosted on Vimeo CDN and can be large. Implement safeguards to prevent bandwidth abuse and ensure smooth playback.

**Acceptance criteria:**
- [ ] Frontend auto-selects the smallest `video_files` entry that meets the project's minimum resolution (default: `medium` / Full HD or lower)
- [ ] Before import, show estimated file size (derived from `width * height * fps * 0.05` as a rough MB estimate, or skip if unknown)
- [ ] Backend enforces a 200MB max download size if proxying video through the backend (optional; prefer direct CDN links for video)
- [ ] Video import stores the `link` URL directly; no backend re-hosting unless explicitly requested

**Verification:**
- [ ] Search videos, verify the correct quality file is selected in preview
- [ ] Import a video, verify the stored `src` is a direct Pexels/Vimeo link

**Dependencies:** Task 6, Task 7

**Files likely touched:**
- `src/components/PexelsMediaPage.js`
- `src/lib/contentLibrary.js`

**Estimated scope:** S

---

### Phase 5: Compliance & Best Practices

#### Task 12: Enforce attribution in the UI
**Description:** Ensure every Pexels asset in the app displays proper attribution per Pexels' Terms of Service.

**Acceptance criteria:**
- [ ] Every preview and library card shows photographer/videographer name with link to their Pexels profile
- [ ] Every preview shows a link back to the original Pexels content page
- [ ] "Pexels" branding link (text or logo) is visible in the media browser footer
- [ ] When exporting or rendering a project that uses Pexels assets, the attribution metadata is included in the export metadata or an end-credits track
- [ ] A global toggle in Settings: "Include Pexels attribution in exports" (default: on)

**Verification:**
- [ ] Inspect a photo card — photographer name and Pexels link are visible
- [ ] Inspect a video card — videographer name and Pexels link are visible
- [ ] Export a project with a Pexels image, verify attribution is present in output

**Dependencies:** Task 5, Task 6

**Files likely touched:**
- `src/components/PexelsMediaPage.js`
- `src/lib/contentLibrary.js`
- `src/components/SettingsPage.jsx` (or equivalent)

**Estimated scope:** M

---

#### Task 13: Terms of Service and usage guardrails
**Description:** Implement technical guardrails to prevent ToS violations (e.g., replicating Pexels as a standalone media library, wallpaper apps, or bulk scraping).

**Acceptance criteria:**
- [ ] App does not allow bulk export of all Pexels metadata or images
- [ ] Search queries are rate-limited per user session (max 30 searches/minute in the UI)
- [ ] API key stored server-side only; client never sees the server's Pexels key
- [ ] Logging: all `/api/pexels` requests logged with `requestId`, endpoint, query, and `X-Ratelimit-Remaining` for auditability
- [ ] Add a `robots.txt` and ensure the app's public pages do not expose Pexels media as indexable content

**Verification:**
- [ ] Attempt rapid-fire search in UI — requests are throttled client-side
- [ ] Inspect network tab — no `Authorization` header with Pexels key is visible on `/api/pexels` calls
- [ ] Backend logs contain requestId for every proxied request

**Dependencies:** Task 2, Task 4

**Files likely touched:**
- `backend/services/pexelsProxyService.js`
- `src/components/PexelsMediaPage.js`

**Estimated scope:** S

---

### Phase 6: Testing & Polish

#### Task 14: Add unit and integration tests
**Description:** Test the proxy service, frontend helper, and page component.

**Acceptance criteria:**
- [ ] `pexelsProxyService.test.js` — tests for success, 429 handling, retry, user key override, rate-limit header forwarding
- [ ] `pexelsApi.test.js` — tests for cache hit, cache miss, error propagation
- [ ] `PexelsMediaPage.test.js` — tests for rendering, search, pagination, preview open/close
- [ ] All tests pass with `npm test -- --grep "pexels"`

**Verification:**
- [ ] `npm test -- --grep "pexels"` passes
- [ ] `npm run build` succeeds

**Dependencies:** Task 2, Task 4, Task 5, Task 6

**Files likely touched:**
- `backend/services/__tests__/pexelsProxyService.test.js` (new)
- `src/lib/__tests__/pexelsApi.test.js` (new)
- `src/components/__tests__/PexelsMediaPage.test.js` (new)

**Estimated scope:** M

---

#### Task 15: Documentation and deployment checklist
**Description:** Document the integration for developers and ops.

**Acceptance criteria:**
- [ ] `docs/pexels-integration.md` created with:
  - Architecture diagram
  - Environment variables list
  - Frontend route and component map
  - Cache TTLs and rate limits
  - Attribution requirements summary
  - Troubleshooting (429s, invalid keys, CORS)
- [ ] `.env.example` updated with `PEXELS_API_KEY`
- [ ] `README.md` updated with a "Stock Media" feature mention
- [ ] Deployment checklist: set `PEXELS_API_KEY` in production env, verify CORS allows `/api/pexels`, verify rate limiter is active

**Verification:**
- [ ] Documentation is accurate and matches implementation
- [ ] New developer can follow docs to run the feature locally

**Dependencies:** All previous tasks

**Files likely touched:**
- `docs/pexels-integration.md` (new)
- `.env.example`
- `README.md`

**Estimated scope:** S

---

## Checkpoint: After Tasks 1–3 (Backend Foundation)
- [ ] Backend starts with new `/api/pexels` routes
- [ ] Manual `curl` tests hit Pexels API through the proxy
- [ ] Rate limiting and retry logic verified

## Checkpoint: After Tasks 4–7 (Frontend Core)
- [ ] Users can search photos and videos
- [ ] Preview modal works with attribution
- [ ] Imported media appears in Library/Content Library
- [ ] All tests pass

## Checkpoint: After Tasks 8–11 (Settings & Optimization)
- [ ] User API key flow works
- [ ] Caching reduces redundant Pexels calls
- [ ] Rate-limit warnings appear correctly
- [ ] Video quality selection works

## Checkpoint: After Tasks 12–15 (Compliance & Polish)
- [ ] Attribution is visible everywhere
- [ ] ToS guardrails are in place
- [ ] Tests pass
- [ ] Documentation is complete

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pexels API key exposed in client bundles | High | Never call `api.pexels.com` from the browser; all calls go through backend proxy |
| Rate limit exhaustion (20k/month default) | High | Server-side caching with 5–60 min TTLs; forward `X-Ratelimit-Remaining` to client; allow user-supplied keys to offload quota |
| Large video downloads slow the UI | Medium | Select appropriate quality by default; show size estimates before import; direct CDN links (no backend re-hosting) |
| Attribution forgotten in exports | Medium | Enforce attribution in preview UI and include metadata in `contentLibrary` entries; add export-time attribution renderer |
| Pexels API deprecation or terms change | Low | Isolate all Pexels-specific code in `pexelsProxyService.js` and `pexelsApi.js` so it can be swapped out |

## Open Questions
- Should the app support Pexels Collections, or is search/curated sufficient for v1?
- Do we need to support Pexels "liked" photos (requires user-specific Pexels auth)?
- Should video imports proxy through the backend for virus scanning, or always use direct CDN links?
