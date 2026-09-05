# Landing Page Thumbnail Audit & Sync

**Date:** 2026-08-17
**Scope:** Thumbnails on the marketing landing page (`src/components/landing/...`) vs. the thumbnails used by the application's own UI/UX (`AppsHub`, `src/lib/thumbnails.js`, `public/thumbnails/*`).

## 1. What was audited

The landing page lists **33 AI Creative Apps** in `LandingPage.jsx` (`ALL_APPS`) and renders them as cards in
`AppsGridSection.jsx`. Before this change those cards used only an **emoji icon** (`getAppIcon`) — no image thumbnail.

The application's UI/UX (`AppsHub.js`) renders its studios with real image thumbnails resolved through
`src/lib/thumbnails.js` (`getStudioThumbnail`, `getHeroThumbnail`, `getPageThumbnail`, `getCategoryThumbnail`).
Image assets live under `public/thumbnails/{studios,heroes,pages,categories,videoagent,templates}`.

## 2. Findings

### A. Landing page had NO image thumbnails
All 33 cards rendered emoji-only. They did not reuse any of the product's real thumbnail assets.

### B. App UI/UX coverage gaps (orphaned / missing assets)
Mapping every app id to the product thumbnail registry revealed:

| App id | Studio/hero key exists? | Product thumbnail used on landing | Note |
|--------|------------------------|-----------------------------------|------|
| image, video, cinema, character, storyboard, effects, edit, upscale, commercial | ✅ | `studios/*.webp` | Core studios — correct asset |
| audio, avatar, training, videotools, chat | ✅ | `studios/*.webp.png` | Core studios — correct asset |
| lipsync | ⚠️ `STUDIO_THUMBNAILS` points to `studios/lipsync.webp` which **does not exist on disk** | `heroes/lipsync.webp.png` | App UI/UX had a broken studio link; hero variant used instead |
| render | ⚠️ `STUDIO_THUMBNAILS` points to `studios/render.webp` which **does not exist on disk** | `heroes/render.webp.png` | Same as above |
| influencer | ✅ (hero) | `heroes/influencer.webp` | Correct asset |
| video-agent | ✅ (hero) | `heroes/videoagent.webp.png` | Correct asset |
| templates | ⚠️ `HERO_THUMBNAILS` points to `heroes/templates.webp.png` which **does not exist on disk** | `pages/templates.webp.png` | Hero variant missing; page variant used |
| ai-vfx | ❌ no key | `categories/vfx.webp` | No dedicated asset — reused VFX category image |
| vfx | ❌ no key | `categories/vfx.webp` | No dedicated asset — reused VFX category image |
| director | ❌ no key | `heroes/cinema.webp` | No dedicated asset — reused Cinema |
| timeline | ❌ no key (file exists) | `heroes/timeline.webp.png` | File existed but was never wired into the registry |
| motion | ❌ no key (file exists) | `videoagent/effects-motion.webp.png` | File existed but never wired in |
| tiktok | ❌ no key (file exists) | `templates/tiktok-video.webp` | File existed but never wired in |
| dubbing | ❌ no key (file exists) | `videoagent/dubbing.webp` | File existed but never wired in |
| workflows | ❌ no key / no asset | `videoagent/header-tools.png` | Best thematic reuse (tooling/automation) |
| agents | ❌ no key | `heroes/videoagent.webp.png` | Reused Video Agent hero |
| mcp-cli | ❌ no key / no asset | `videoagent/header-tools.png` | Best thematic reuse (tooling/integration) |
| library, community, assist, explore | ✅ (page) | `pages/*.webp(.png)` | Correct asset |

**Discrepancies worth fixing in the product itself (out of scope for landing, noted for follow-up):**
- `STUDIO_THUMBNAILS.lipsync` and `.render` reference files that do not exist on disk (broken images in `AppsHub`).
- `HERO_THUMBNAILS.templates` references a file that does not exist on disk.
- `ai-vfx`, `vfx`, `director`, `timeline`, `motion`, `tiktok`, `dubbing`, `workflows`, `agents`, `mcp-cli` are not registered as thumbnail keys at all, so the app cannot show an image for them anywhere.

## 3. Action taken

1. **Centralized mapping** — added `APP_THUMBNAILS` + `getAppThumbnail(appId)` to `src/lib/thumbnails.js`. This is the single source of truth so the landing page and (future) app surfaces stay in sync.
2. **Landing cards now show the matching product thumbnail** — `AppsGridSection.jsx` renders a thumbnail banner (with emoji badge overlay, gradient, and graceful `thumb-fallback`) above each app's title + description + "Open {title}" link. Content (title/description) is unchanged from `ALL_APPS`.

## 4. Result

**33 / 33** landing cards now display a thumbnail that matches the application's UI/UX assets. Every path was verified to exist on disk (`public/thumbnails/...`). Cards degrade to a styled gradient placeholder if any image fails to load (using the existing global `.thumb-fallback` style).

## 5. Recommended follow-ups (product, not landing)

- Fix `STUDIO_THUMBNAILS.lipsync`/`render` and `HERO_THUMBNAILS.templates` to point at real files.
- Register `timeline`, `motion`, `tiktok`, `dubbing` (and optionally `ai-vfx`, `vfx`, `director`, `workflows`, `agents`, `mcp-cli`) in the thumbnail registry so the in-app `AppsHub` can reuse `getAppThumbnail`.
