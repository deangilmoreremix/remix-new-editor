# Feature Registry

One page per feature, kept in the same PR that ships it. Copy `_TEMPLATE.md` into `docs/features/<area>/<feature>.md`,
fill it in, then run `node scripts/build-feature-index.mjs` to refresh this table.
Use `--check` in CI or before committing to catch bad status values and dead code paths.

<!-- generated: do not edit below this line -->

| Feature | Area | Status | Where in app | Added | Details |
|---|---|---|---|---|---|
| Client Analytics Events | platform | live | `src/lib/analytics.js` | 2026-03-18 | [page](platform/analytics-events.md) |
| Dynamic Control Engine | platform | live | Every studio > Advanced controls panel | 2026-08-11 | [page](platform/dynamic-control-engine.md) |
| Error Boundary and Global Error Handlers | platform | live | Wraps the app | 2026-07-31 | [page](platform/error-handling.md) |
| Generation History | platform | live | Saved automatically after each generation; shown in Library | 2026-08-24 | [page](platform/generation-history.md) |
| MuAPI Proxy (edge function) | platform | live | Supabase edge function `muapi-proxy` | 2026-03-14 | [page](platform/muapi-proxy.md) |
| Permanent Asset Library | platform | live | Used by upload pickers in studios; browsed in Library > Uploads | 2026-10-17 | [page](platform/permanent-asset-library.md) |
| Rate Limiter | platform | live | `src/lib/services/RateLimiter.js` | 2026-07-06 | [page](platform/rate-limiter.md) |
| Security Helpers | platform | live | `src/lib/security.js` | 2026-03-24 | [page](platform/security-helpers.md) |
| Supabase Edge Functions | platform | live | `supabase/functions/` | 2026-03-14 | [page](platform/supabase-edge-functions.md) |
| Academy | studios | live | #/academy | 2026-08-14 | [page](studios/academy.md) |
| AI VFX Studio | studios | live | #/ai-vfx | 2026-07-04 | [page](studios/ai-vfx.md) |
| Animate | studios | live | #/animate | 2026-08-30 | [page](studios/animate.md) |
| Apps Hub | studios | live | #/apps | 2026-03-10 | [page](studios/apps-hub.md) |
| Asset Canvas Editor | studios | live | #/asset-edit | 2026-08-30 | [page](studios/asset-edit.md) |
| Asset Library | studios | live | #/library | 2026-03-10 | [page](studios/library.md) |
| Audio Studio | studios | live | #/audio | 2026-03-18 | [page](studios/audio.md) |
| Avatar Studio | studios | live | #/avatar | 2026-03-18 | [page](studios/avatar.md) |
| Brand DNA Editor | studios | live | #/brand-dna | 2026-08-30 | [page](studios/brand-dna.md) |
| Brand Studio | studios | live | #/brand | 2026-08-29 | [page](studios/brand-studio.md) |
| Campaign Studio | studios | live | #/campaign; saved campaign detail at #/campaign-page | 2026-08-30 | [page](studios/campaign.md) |
| Character Studio | studios | live | #/character; overview at #/character-page | 2026-03-10 | [page](studios/character.md) |
| Cinema Studio | studios | live | #/cinema; overview at #/cinema-page | 2026-02-14 | [page](studios/cinema.md) |
| Cinema Template Studio | studios | live | #/cinema-template | 2026-04-02 | [page](studios/cinema-template.md) |
| Commercial Studio | studios | live | #/commercial; overview at #/commercial-page | 2026-03-10 | [page](studios/commercial.md) |
| Content Library | studios | live | #/content-library | 2026-08-07 | [page](studios/content-library.md) |
| Director Agents | studios | live | #/director | 2026-03-18 | [page](studios/director.md) |
| Edit Studio | studios | live | #/edit (deep link /?tool=<slug>#/edit) | 2026-03-10 | [page](studios/edit.md) |
| Effects Studio | studios | live | #/effects; overview at #/effects-page | 2026-03-10 | [page](studios/effects.md) |
| Explore | studios | live | #/explore (old #/community redirects here) | 2026-03-10 | [page](studios/explore.md) |
| Find My Brand | studios | live | #/find-my-brand | 2026-11-02 | [page](studios/find-my-brand.md) |
| Focused Generation Pages | studios | live | #/text-to-image, #/image-to-image, #/text-to-video, #/image-to-video, #/video-to-video, #/video-watermark | 2026-03-15 | [page](studios/focused-generation-pages.md) |
| Image Studio | studios | live | #/image | 2026-02-12 | [page](studios/image.md) |
| Influencer Studio | studios | live | #/influencer; overview at #/influencer-page | 2026-03-10 | [page](studios/influencer.md) |
| Lead Finder | studios | live | #/leadfinder | 2026-08-30 | [page](studios/leadfinder.md) |
| Lip Sync Studio | studios | live | #/lipsync | 2026-03-24 | [page](studios/lipsync.md) |
| Motion Director | studios | live | #/motion-director (and #/motion-director/workbench) | 2026-11-05 | [page](studios/motion-director.md) |
| Motion Workbench | studios | live | #/workbench (old #/cinegen redirects here) | 2026-11-02 | [page](studios/workbench.md) |
| Personalizer | studios | live | #/personalizer | 2026-08-23 | [page](studios/personalizer.md) |
| Photo Studio | studios | live | #/photo-studio (alias #/brand-photo-studio) | 2026-08-30 | [page](studios/photo-studio.md) |
| Render | studios | live | #/render | 2026-03-18 | [page](studios/render.md) |
| Smart Video Scheduler | studios | live | #/smart-video-scheduler (alias #/brightbean) | 2026-08-30 | [page](studios/smart-video-scheduler.md) |
| SmartVideo Studio | studios | live | #/smart-video-studio | 2026-09-02 | [page](studios/smart-video-studio.md) |
| SmartVideo Viral | studios | live | #/viral | 2026-08-20 | [page](studios/viral.md) |
| Storyboard Studio | studios | live | #/storyboard; overview at #/storyboard-page | 2026-03-10 | [page](studios/storyboard.md) |
| Templates | studios | live | #/templates (template/<id> deep links) | 2026-03-10 | [page](studios/templates.md) |
| Timeline Editor (classic) | studios | live | #/timeline-classic | 2026-07-05 | [page](studios/timeline-classic.md) |
| Upscale Studio | studios | live | #/upscale; overview at #/upscale-page | 2026-03-10 | [page](studios/upscale.md) |
| Video Agent | studios | live | #/video-agent (alias #/video-agent-studio) | 2026-11-02 | [page](studios/video-agent.md) |
| Video Studio | studios | live | #/video | 2026-02-17 | [page](studios/video.md) |
| Video Tools Studio | studios | live | #/videotools | 2026-03-18 | [page](studios/videotools.md) |
| Website Builder (OpenThorn) | studios | live | #/website-builder | 2026-08-23 | [page](studios/website-builder.md) |
| Zack D Studio | studios | live | #/zackd (alias #/zackd-studio) | 2026-11-05 | [page](studios/zackd-studio.md) |
| Add to Timeline Modal | timeline | live | Timeline editor > Add to timeline | 2026-11-12 | [page](timeline/add-to-timeline.md) |
| Animations Library | timeline | live | Timeline editor > Animations (HyperFrames + RemotionUI) | 2026-11-10 | [page](timeline/animations-library.md) |
| Asset Finder Background Removal | timeline | live | Personalization modal > discovered assets | 2026-11-12 | [page](timeline/asset-finder-bg-removal.md) |
| Stock Media Browser | timeline | live | Timeline editor > stock media panel | 2026-11-12 | [page](timeline/stock-media-browser.md) |
| Timeline Analytics, Audience, Retarget and Alerts | timeline | live | Timeline editor > Analytics tab | 2026-11-13 | [page](timeline/timeline-analytics.md) |
| Timeline Projects and Publishing | timeline | live | Timeline editor > Projects, Share | 2026-11-11 | [page](timeline/timeline-projects-publishing.md) |
| Timeline Studio Editor | timeline | live | #/timeline (previous editor at #/timeline-classic) | 2026-11-07 | [page](timeline/timeline-editor.md) |
