# Capture report (no-key route, interaction pass)

Method: Playwright 1.63 (global), 1920x1080, dark scheme, real running app (vite dev :3100), nothing mocked or generated.
Scripts: `video/capture.cjs` (survey), `interact1-4.cjs` (interactions + screen recordings). Not signed in: no Clerk/Supabase config.
First-run "set up your API keys" popup suppressed with the app's own `setup_popup_shown` session flag (same effect as "Skip for now").
Contact sheet: `video/contact-sheet-2.png`. Frames in `video/captures/<shot>/`; `.webm` recordings where motion matters.
Routes are plain hash routes (`/#/video`); give lazy studios ~12s to load.

## Captured (real UI, no errors, no dev overlays)
| Shot | What exists |
|---|---|
| 01 Video Studio | empty + prompt typed (typing recorded), Motion & Style sliders, Advanced options |
| 02 Apps hub | all sections scrolled (stills + scroll recording) |
| 03 Model picker | open, scrolling through full list (recorded) |
| 04 Image Studio | empty, prompt typed, Advanced panel (prompt/aspect/style/negative) |
| 05 Cinema | Prompt Builder open (camera/lens/aperture/movement); Director UI (empty video pane) |
| 07 Edit | real before/after gallery (16 tools), Upscale form |
| 08-10 Character, Influencer, Avatar, Lip Sync, AI-VFX, Effects | studio UIs; AI-VFX and Effects show real example galleries |
| 11 Timeline | Project Manager + New Project dialog |
| 12 Templates / Commercial | niche template grid (real thumbnails), Product Shot form |
| 15 Library, Community | Library is an empty state ("0 items"); Community/Explore is populated |

## Not captured / unusable
| Shot | Reason |
|---|---|
| Hero finished clip; results for 4,5,7,8,9,10,12,13 | need generation (no MuAPI key). Not faked. |
| 06 Storyboard 8-step pipeline, script gate, live cost counter | not on this page: it is a plain form. That pipeline is the OpenMontage/Backlot board (`python -m backlot open`), a separate tool; not captured. |
| 13 Video Agent | studio renders an unbuilt `Motion-agent/index.html` "Coming soon" placeholder (apps/motion-agent not built). |
| 14 Chat/Assist | `chat`/`assist` routes alias to the Apps hub. The real feature is the floating "Ask SmartVideo" panel; it opens, but shows an "Add your OpenAI key" nag, so not a clean frame. |
| 15 Stock media | `media-hub`/`pexels-media` route to Library/empty. No stock browser reached. |
| 16 Agency dashboard | Campaign route shows "Brand not found"; needs brand data + sign-in. |
| 11 Timeline editor canvas, 11b Render | Timeline stops at the project dialog; Render page loads (forms) but no scenes/captions/audio to film without a project. |
| Cinema builder lower half | partially framed; needs scroll in a recording. |

## Claims conflicts seen in the real app (do not put in videos until confirmed)
- Video Studio hero says "15+ models"; Image Studio says "20+ models"; Apps hub tags "20+ models".
- Model picker list has 133 rows (may include group headers/variants); real distinct count unverified.
- Hub shows 28 app cards (6 image, 11 video, 9 agents, 2 my work), vs 33 apps on the landing page.
- Landing copy says 200+ models / $297 lifetime; metadata says 20+ models / free and open-source (from your brief).

## Phase 0
- Thumbnails: already fixed in repo (studios/lipsync.webp, studios/render.webp exist; HERO templates -> pages/templates.webp.png exists). LANDING_THUMBNAIL_AUDIT.md is stale. No commit needed.
- Director `escapeHtml is not defined`: not reproduced (loads, no page errors). Need repro steps.
