# Capture report (Phase 1, partial)

Method: Playwright, 1920x1080, dark colour scheme, unauthenticated, vite dev server on :3100, first-run key modal dismissed ("Skip for now"). Script: scratchpad cap.cjs. Contact sheet: contact-sheet.png.

## Blockers affecting every shot
- No provider keys. The app is BYOK: Muapi, OpenAI and VideoDB keys are entered in the UI. None are available, so no generation ever ran. No prompt-to-result, before/after, model-count scrolling, or end-to-end run can be captured honestly.
- No Supabase env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) and no demo account: not signed in.
- Sandbox proxy blocks external hosts (ERR_TUNNEL_CONNECTION_FAILED): some remote images/fonts may be missing.

## Per-shot status
| Shot | Capture | Status |
|---|---|---|
| 01 Hero (prompt typed + clip) | 01-hero-video-studio | FAILED: page blank (route `#/hero`-less; `#/video` empty body in this run, 0 chars). Clip needs a key anyway |
| 02 Apps hub | 02-apps-hub | Page only; the "33 apps" count is not verified/visible |
| 03 Model picker | 03-model-picker | Studio page only; picker not opened, no count |
| 04 Image Studio | 04-image-studio | Idle UI only; no result, advanced panel not opened |
| 05 Cinema / Director | 05a, 05b | Idle UI only; Director loads, no escapeHtml error seen |
| 06 Storyboard / Backlot | 06a | Idle UI only; Backlot is a separate OpenMontage board, not captured; no cost counter |
| 07 Edit tools | 07a, 07b | Edit gallery has stock before/after tiles (check provenance); upscale idle |
| 08 Character / Influencer | 08a, 08b | Idle UI only; no 4-6 scene run |
| 09 Avatar / Lip Sync / Dubbing | 09a, 09b | Idle UI only; no 3-language clip; no dubbing route captured |
| 10 AI-VFX / Effects | 10a, 10b | Idle UI; template tiles only; nothing applied to a clip |
| 11 Timeline / Render | 11a, 11b | FAILED: stuck on loading spinner |
| 12 Templates / Commercial | 12a, 12b | FAILED: blank / spinner. Commercial route resolved to Product Shot page in the sheet |
| 13 Video Agent | 13 | FAILED: route showed Product Shot Studio, not Video Agent; needs a key anyway |
| 14 Chat / Assist | 14a, 14b | FAILED: both show the Apps hub, not chat/assist |
| 15 Library / Community / Stock | 15a, 15b, 15c | Library empty (needs sign-in); Community (Explore) OK; stock-media route shows Library, not Pexels |
| 16 Agency dashboard | none | FAILED: no route found in router |

Usable as-is (idle UI): 02, 03, 04, 05a, 05b, 07a, 08a, 08b, 09a, 09b, 10a, 10b, 15b. None show a result, so none can carry a feature claim.
