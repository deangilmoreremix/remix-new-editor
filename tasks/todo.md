# Pexels API Integration — Todo List

## Phase 1: Backend Foundation

- [ ] Task 1: Add Pexels environment configuration
  - [ ] `PEXELS_API_KEY` added to `.env.example` with instructions
  - [ ] Backend reads `PEXELS_API_KEY` from `process.env` with clear startup warning if missing

- [ ] Task 2: Create Pexels proxy service
  - [ ] Express router mounted at `/api/pexels`
  - [ ] Endpoints: `GET /photos/search`, `GET /photos/curated`, `GET /photos/:id`, `GET /videos/search`, `GET /videos/popular`, `GET /videos/:id`
  - [ ] Server-side key used by default; optional `x-pexels-api-key` header allows caller override
  - [ ] `withRetry` wrapper (maxAttempts=2, baseDelay=500ms) on all outbound Pexels calls
  - [ ] Response shapes match Pexels docs exactly
  - [ ] Rate-limit headers forwarded to the client
  - [ ] 429 responses propagate with a clear error message

- [ ] Task 3: Register Pexels routes in server.js
  - [ ] `pexelsProxyService` imported in `backend/server.js`
  - [ ] Mounted at `/api/pexels` with `optionalAuth`
  - [ ] Rate limiter configured: 30 req/min per IP for search, 60 req/min for detail

### Checkpoint: After Tasks 1–3
- [ ] Backend starts with new `/api/pexels` routes
- [ ] Manual `curl` tests hit Pexels API through the proxy
- [ ] Rate limiting and retry logic verified

---

## Phase 2: Frontend Core

- [ ] Task 4: Create Pexels API client helper
  - [ ] Helper functions: `searchPhotos`, `searchVideos`, `getPhoto`, `getVideo`, `getCuratedPhotos`, `getPopularVideos`
  - [ ] All calls go to `/api/pexels/...`
  - [ ] Search results cached in `sessionStorage` keyed by query + filters for 5 minutes
  - [ ] Cache hit returns instantly without network request
  - [ ] Errors surface as thrown objects with `message` and optional `status`

- [ ] Task 5: Build Pexels media browser page
  - [ ] Route registered in `src/lib/router.js` as `pexels-media` → `PexelsMediaPage`
  - [ ] Hero banner with title "Stock Media" and subtitle
  - [ ] Filter tabs: Photos, Videos, All
  - [ ] Search input with debounced query (300ms)
  - [ ] Responsive grid: 2 cols mobile, 3 cols tablet, 4 cols desktop
  - [ ] Infinite scroll pagination using `next_page` URLs
  - [ ] Loading skeleton while fetching
  - [ ] Empty state when no results found
  - [ ] Error toast with retry button on fetch failure

- [ ] Task 6: Implement preview modal
  - [ ] Clicking a grid item opens the preview overlay
  - [ ] Photos display the `large2x` or `original` src with aspect-ratio containment
  - [ ] Videos display the `image` thumbnail with a play button overlay; clicking opens the actual video in a `<video>` element with controls
  - [ ] Attribution panel shows: photographer/videographer name, Pexels profile link, Pexels content link
  - [ ] "Import to Project" button that emits a custom event (`pexels:import`) with the full media object
  - [ ] Close on backdrop click or Escape key
  - [ ] Keyboard accessible: Tab trapped inside modal while open

- [ ] Task 7: Wire import into project workflow
  - [ ] Import action calls `saveContentLibraryEntry` with Pexels metadata
  - [ ] Stored fields: `type`, `src`, `thumb`, `width`, `height`, `duration` (video), `attribution`, `pexelsId`, `source: 'pexels'`
  - [ ] After import, show a success toast and close the preview
  - [ ] Imported media appears in the user's Library page with a "Pexels" badge

### Checkpoint: After Tasks 4–7
- [ ] Users can search photos and videos
- [ ] Preview modal works with attribution
- [ ] Imported media appears in Library/Content Library
- [ ] All tests pass

---

## Phase 3: Settings & User Preferences

- [ ] Task 8: Add Pexels API key to Settings
  - [ ] Settings UI gains a "Pexels API Key" field
  - [ ] Key stored via `ApiKeyManager` with kind `pexels`
  - [ ] Backend proxy reads user-supplied key from `x-pexels-api-key` header and uses it instead of the server key
  - [ ] Validation: key must be at least 20 chars
  - [ ] "Test Connection" button that calls `/api/pexels/photos/search?query=test&per_page=1` and reports success/failure

### Checkpoint: After Tasks 8
- [ ] User API key flow works

---

## Phase 4: Optimization & Scaling

- [ ] Task 9: Implement backend caching layer
  - [ ] Cache key: `method + url + query string`
  - [ ] TTL: 300 seconds for search endpoints, 600 seconds for curated/popular, 3600 seconds for detail endpoints
  - [ ] Max cache entries: 500
  - [ ] Stale-while-revalidate: return cached response immediately, refresh in background if expired
  - [ ] `Cache-Control` response headers set to `public, max-age=TTL`
  - [ ] Logging: cache hit/miss rates logged per requestId

- [ ] Task 10: Implement rate-limit awareness and graceful degradation
  - [ ] Backend parses `X-Ratelimit-Remaining` and `X-Ratelimit-Reset` on every successful Pexels response
  - [ ] When remaining < 50, frontend shows a subtle banner
  - [ ] When remaining = 0, frontend disables search and shows a message
  - [ ] Server logs a warning when remaining < 20
  - [ ] Server rejects non-essential proactive requests when remaining < 10

- [ ] Task 11: Add video download and transcoding guardrails
  - [ ] Frontend auto-selects the smallest `video_files` entry that meets the project's minimum resolution
  - [ ] Before import, show estimated file size
  - [ ] Video import stores the `link` URL directly; no backend re-hosting

### Checkpoint: After Tasks 9–11
- [ ] Caching reduces redundant Pexels calls
- [ ] Rate-limit warnings appear correctly
- [ ] Video quality selection works

---

## Phase 5: Compliance & Best Practices

- [ ] Task 12: Enforce attribution in the UI
  - [ ] Every preview and library card shows photographer/videographer name with link
  - [ ] Every preview shows a link back to the original Pexels content page
  - [ ] "Pexels" branding link is visible in the media browser footer
  - [ ] When exporting, attribution metadata is included
  - [ ] Global toggle in Settings: "Include Pexels attribution in exports" (default: on)

- [ ] Task 13: Terms of Service and usage guardrails
  - [ ] App does not allow bulk export of all Pexels metadata or images
  - [ ] Search queries are rate-limited per user session (max 30 searches/minute)
  - [ ] API key stored server-side only; client never sees the server's Pexels key
  - [ ] Logging: all `/api/pexels` requests logged with `requestId`, endpoint, query, and `X-Ratelimit-Remaining`
  - [ ] `robots.txt` ensures public pages do not expose Pexels media as indexable content

### Checkpoint: After Tasks 12–13
- [ ] Attribution is visible everywhere
- [ ] ToS guardrails are in place

---

## Phase 6: Testing & Polish

- [ ] Task 14: Add unit and integration tests
  - [ ] `pexelsProxyService.test.js` — tests for success, 429 handling, retry, user key override, rate-limit header forwarding
  - [ ] `pexelsApi.test.js` — tests for cache hit, cache miss, error propagation
  - [ ] `PexelsMediaPage.test.js` — tests for rendering, search, pagination, preview open/close
  - [ ] All tests pass with `npm test -- --grep "pexels"`

- [ ] Task 15: Documentation and deployment checklist
  - [ ] `docs/pexels-integration.md` created with architecture, env vars, route map, cache TTLs, attribution requirements, troubleshooting
  - [ ] `.env.example` updated with `PEXELS_API_KEY`
  - [ ] `README.md` updated with a "Stock Media" feature mention
  - [ ] Deployment checklist created

### Checkpoint: Complete
- [ ] All acceptance criteria met
- [ ] Ready for review
