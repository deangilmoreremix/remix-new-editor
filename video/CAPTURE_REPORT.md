# Capture report (no-key route)

Method: Playwright, 1920x1080, dark scheme, real running app (vite dev, :3100), nothing mocked.
Script: `video/capture.cjs`. Not signed in (no Clerk/Supabase config); no provider keys, so nothing was generated.
The first-run "set up your API keys" popup is suppressed with the app's own `setup_popup_shown` session flag (same as "Skip for now").
Frames are page-load only (nothing typed, opened or scrolled yet).

## Usable as a base frame
01 video-studio, 02 apps-hub (top of grid only; needs scroll for all 33), 05 cinema-studio, 05b director, 06 storyboard (empty form),
07 edit-tools (real before/after gallery), 07b upscale, 08 character, 08b influencer, 09 avatar, 09b lipsync,
10 ai-vfx (example gallery), 10b effects, 12 templates (niche grid), 12b commercial, 15b community, 15 library (empty state).

## Failed / not captured
| Shot | Reason |
|---|---|
| 03 model picker | Route shows a spinner; picker never opened. Needs click interaction on Video Studio. |
| 04 image studio | Blank page (0 chars). Route `image` renders nothing at 6s; needs investigation. |
| 11 timeline | Stuck on spinner. |
| 11b render | Blank page (0 chars). |
| 13 video-agent | Renders almost empty (single placeholder). |
| 14 chat, 14b assist | Both route to the Apps hub, not chat/assist. Wrong route names. |
| 15c stock | Routes to Library; `pexels-media` is not the stock page. |
| 16 agency | "Brand not found" empty state. Needs a brand record (needs sign-in/data). |
| Hero finished clip; results for shots 4,5,7,8,9,10,12,13 | Require generation (no MuAPI key). Not captured, not faked. |
| Prompt typing, model scroll, controls panels | Interaction passes not done yet. |

Open item: Director "escapeHtml is not defined" not reproduced (page loads, no page errors).
