# Pexels API Integration

## Overview

The Pexels API integration provides users with a searchable library of stock photos and videos. Users can search, preview, and import Pexels media directly into their projects.

## Architecture

```
Frontend (Vite SPA)
  │
  ├── src/lib/pexelsApi.js          → Frontend API client (calls backend proxy)
  ├── src/components/PexelsMediaPage.js → Media browser UI
  ├── src/lib/pexelsLibrary.js      → LocalStorage-backed Pexels import library
  └── src/lib/editor/pexelsIntegration.js → Timeline integration
         │
         ▼
Backend (Express :3001)
  │
  ├── backend/services/pexelsProxyService.js → Pexels API proxy
  │     ├── Server-side key (PEXELS_API_KEY)
  │     ├── Optional user key override (x-pexels-api-key)
  │     ├── In-memory LRU cache (TTL: 5min search, 10min curated, 1hr detail)
  │     └── Rate-limit header forwarding
  │
  ▼
Pexels API (api.pexels.com)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PEXELS_API_KEY` | Yes (server) | Server-side Pexels API key. Get one at [pexels.com/api](https://www.pexels.com/api/) |

## Files

### Backend

| File | Purpose |
|------|---------|
| `backend/services/pexelsProxyService.js` | Express router at `/api/pexels`. Proxies photos/search, photos/curated, photos/:id, videos/search, videos/popular, videos/:id. Includes retry, caching, and rate-limit forwarding. |
| `backend/server.js` | Mounts `pexelsProxyService` at `/api/pexels` with rate limiting (30 req/min). |

### Frontend

| File | Purpose |
|------|---------|
| `src/lib/pexelsApi.js` | API client helper. Functions: `searchPhotos`, `searchVideos`, `getCuratedPhotos`, `getPopularVideos`, `getPhoto`, `getVideo`. Includes `sessionStorage` caching (5 min TTL). |
| `src/components/PexelsMediaPage.js` | Full-page media browser. Filter tabs (Photos/Videos/All), debounced search, responsive grid, infinite scroll, preview modal with attribution, import buttons. |
| `src/lib/pexelsLibrary.js` | LocalStorage-backed library for imported Pexels media. |
| `src/lib/editor/pexelsIntegration.js` | Bridges Pexels media with the Timeline Editor. `initializePexelsIntegration(state, showToast)` returns `addToTimeline` and `getTargetTrack`. |
| `src/lib/apiKeyManager.js` | Manages Pexels API key in browser storage (sessionStorage + localStorage, obfuscated). |
| `src/components/SettingsModal.js` | Settings UI. Includes Pexels API Key form with Test Connection. |
| `src/lib/router.js` | Route map: `'Stock Media': 'pexels-media'` → `PexelsMediaPage`. |

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pexels/photos/search` | Search photos. Query: `query`, `orientation`, `size`, `color`, `locale`, `page`, `per_page` |
| GET | `/api/pexels/photos/curated` | Curated photos. Query: `page`, `per_page` |
| GET | `/api/pexels/photos/:id` | Get photo by ID |
| GET | `/api/pexels/videos/search` | Search videos. Query: `query`, `orientation`, `size`, `locale`, `page`, `per_page` |
| GET | `/api/pexels/videos/popular` | Popular videos. Query: `page`, `per_page` |
| GET | `/api/pexels/videos/:id` | Get video by ID |
| GET | `/api/pexels/health` | Health check |

## User Flow

1. User navigates to **Stock Media** page (`/#/pexels-media`)
2. Browses curated photos/videos or searches with debounced input (300ms)
3. Filters by Photos, Videos, or All
4. Clicks a media item to open preview modal
5. Preview shows:
   - Full-size media (photo or video with controls)
   - Attribution: photographer/videographer name + Pexels profile link
   - "View on Pexels" link
   - **Add to Timeline** button
   - **Import to Project** button
6. Import saves to Pexels Library (localStorage) with attribution metadata

## Caching

| Layer | TTL | Scope |
|-------|-----|-------|
| Backend in-memory LRU | 5 min (search), 10 min (curated/popular), 1 hr (detail) | Shared across all users |
| Frontend sessionStorage | 5 min | Per-browser-tab |
| `Cache-Control: public, max-age=TTL` | Set on responses | CDN/edge caches |

## Rate Limits

- **Backend**: 30 requests/minute per IP (express-rate-limit)
- **Pexels default**: 200 req/hour, 20,000 req/month (varies by key)
- **Client-side**: 30 searches/minute per session
- **Quota warnings**:
  - `< 50 remaining`: Yellow banner in UI
  - `= 0 remaining`: Red banner, search disabled
  - `< 20 remaining`: Server logs warning

## Attribution Requirements

Per Pexels Terms of Service:
- Every preview shows photographer/videographer name linked to their Pexels profile
- Every preview shows "View on Pexels" link to the original content
- Pexels branding footer: "Media provided by [Pexels](https://www.pexels.com)"
- Imported metadata stores `photographer`, `photographer_url`, `pexelsUrl`

## ToS Guardrails

- Server key never exposed to browser (all calls go through `/api/pexels`)
- Request logging with `requestId`, endpoint, query, and `X-Ratelimit-Remaining`
- Client-side rate limiting (30 searches/min)
- No bulk export endpoints
- Video quality auto-selection (smallest adequate file, max Full HD)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 500 on `/api/pexels/*` | Set `PEXELS_API_KEY` in server environment |
| 429 Too Many Requests | Wait for quota reset or add user key in Settings |
| Empty results | Check query spelling; Pexels may have limited results for niche terms |
| Video not playing | Check browser codec support; Pexels serves H.264 MP4 via Vimeo CDN |

## Testing

```bash
# Run all Pexels tests
npx vitest run backend/tests/pexelsProxyService.test.js src/lib/__tests__/pexelsApi.test.js src/components/__tests__/PexelsMediaPage.test.js

# Run with filter
npx vitest run -t pexels
```

## Deployment Checklist

- [ ] Set `PEXELS_API_KEY` in production environment
- [ ] Verify `/api/pexels` CORS is allowed
- [ ] Verify rate limiter is active (30/min)
- [ ] Verify `Cache-Control` headers are set
- [ ] Confirm Pexels attribution is visible in deployed UI
- [ ] Monitor `X-Ratelimit-Remaining` in logs
