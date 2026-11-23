# Capture report (Phase 1, revision 2: live site)

Source: https://smartvid.app (production build, signed out), Playwright, 1920x1080, dark scheme, first-run key dialog dismissed. Revision 1 used the local vite dev server, which lacked the built Workbench bundle and had blocked images; it is superseded. Contact sheet: contact-sheet.png (26 captures).

## Blockers that remain
- No provider keys (Muapi, OpenAI, VideoDB are BYOK, entered in the UI) and no signed-in account (Clerk connector needs re-auth). No generation can run, so no prompt-to-result, before/after outcome, model-count scroll, 3-language clip or live cost counter has been captured. None are faked.
- Some third-party images are blocked by the sandbox proxy (ERR_TUNNEL_CONNECTION_FAILED) and a few calls return 401 (signed out).

## Per-shot status
| Shot | Capture | Status |
|---|---|---|
| 01 Hero | 01-hero-video-studio | Idle Video Studio only; no typed prompt or finished clip |
| 02 Apps hub | 02-apps-hub | Page OK; "33 apps" count not verified on screen |
| 03 Model picker | 03-model-picker | Studio page only (same as 01); picker not opened, no count |
| 04 Image Studio | 04-image-studio | Idle only; advanced panel not opened |
| 05 Cinema / Director | 05a, 05b | Idle only |
| 06 Storyboard / Backlot | 06a | Idle only; Backlot is an OpenMontage board, not captured; no cost counter |
| 07 Edit tools | 07a, 07b | Edit gallery shows before/after tiles (provenance unchecked); upscale idle |
| 08 Character / Influencer | 08a, 08b | Idle only |
| 09 Avatar / Lip Sync / Dubbing | 09a, 09b | Idle only; no dubbing route captured |
| 10 AI-VFX / Effects | 10a, 10b | Idle only |
| 11 Timeline / Render | 11a workbench, 11b timeline, 11c render-legacy | Workbench (replaces Render in nav) loads: empty project with demo timeline. Timeline shows empty project manager. Render is an empty shell (placeholder title "Generated Video Prompt Title"): do not use |
| 12 Templates / Commercial | 12a, 12b | Templates grid OK. Commercial route shows Product Shot Studio: wrong page |
| 13 Video Agent | 13 | Idle "What do you want to create?" prompt; no run |
| 14 Chat / Assist | 14a, 14b | FAILED: both show Apps hub; correct entry point unknown |
| 15 Library / Community / Stock | 15a, 15b, 15c | Library empty (401, signed out); Community OK; stock route shows Library, not Pexels |
| 16 Agency dashboard | none | FAILED: no route found |

Usable now as screen-tour frames: 02, 05b, 07a, 11a, 12a, 13, 15b and the studio idle pages. None shows a generated result.
