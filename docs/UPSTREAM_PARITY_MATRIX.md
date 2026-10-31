# Upstream feature parity matrix

Compares the studios that exist in this repo with their counterparts in
[Anil-matcha/Open-Generative-AI](https://github.com/Anil-matcha/Open-Generative-AI)
(`0e15dc3`, 2026-10-29). Scope is features and functions only — not visual
design, not upstream-only studios (Layers, Recast, Motion Control, Clipping,
Workflow, McpCli, Design Agent), and not Electron/local Wan2GP inference.

This replaces the August audit docs (`UPSTREAM_RECOVERY_*`, `UPSTREAM_CONTROL_INVENTORY.md`).

Status: **HAVE** (already here) · **ADDED** (added by the parity work) ·
**PLANNED** (queued, see phase) · **SKIPPED** (with reason).

## Studio pairs

| Ours | Upstream |
|---|---|
| `ImageStudio.js` | `ImageStudio.jsx` (+ `DrawModal.jsx`) |
| `VideoStudio.js` | `VideoStudio.jsx` |
| `CinemaStudio.js` | `CinemaStudio.jsx` |
| `LipSyncStudio.js` | `LipSyncStudio.jsx` |
| `AudioStudio.js` | `AudioStudio.jsx` |
| `EffectsStudio.js` ("Vibe Motion") | `VibeMotionStudio.jsx` |
| `InfluencerStudio.js` | `AiInfluencerStudio.jsx` |
| `CommercialStudio.js` | `MarketingStudio.jsx` |
| `AppsHub.js` | `AppsStudio.jsx` |

`VideoAgentPage.js` / `AssistPage.js` vs upstream `AgentStudio.jsx` (a MuAPI
agent marketplace) are not comparable and are out of scope.

## Shared functions (Phase 2)

| Function | Image | Video | Cinema | Lip Sync | Audio | Effects | Commercial |
|---|---|---|---|---|---|---|---|
| Resume unfinished jobs after reload | ADDED | ADDED | ADDED | HAVE | ADDED | SKIPPED¹ | SKIPPED¹ |
| Delete history item (with confirm, local + cloud) | ADDED | ADDED² | ADDED | ADDED | HAVE | PLANNED³ | PLANNED³ |
| Copy prompt / copy image | HAVE | — | ADDED | — | — | — | — |
| Failed job reported at once, with refund notice | ADDED (all studios, `muapi.pollForResult`) |||||||
| Credit balance shown | ADDED (header, all studios) |||||||
| Per-request cost estimate | SKIPPED — upstream defines `calculateDynamicCost` but no studio calls it |||||||

¹ Multi-step pipelines (layered effects compositing, still product shots) — no single job to resume.
² Video already deleted locally; now asks for confirmation and removes the cloud copy too.
³ These studios have no history panel yet; delete comes with it in their Phase 3 PR.

## Already at parity

- Image: negative prompt, seed, guidance/strength (`src/lib/modelInputExtensions.js`), batch count, upload history reuse.
- Video: native audio toggle, end frame, history delete, upload history reuse.
- Cinema: camera / lens / focal / aperture builder. Advanced settings were rendered but never sent — fixed in Phase 2.
- Audio: schema-driven fields, lyrics, uploads, history grid, prompt chips. Ours also has a voice selector and share.
- Influencer: Face / Body / Style attribute builder (~128 options). Ours also has history delete.

## Model catalog (synced)

`scripts/sync-upstream-models.py` (dry-run by default, `--write` to apply) added 355 upstream
models across text/image-to-image/video, audio and lip sync, plus shared constants. The build
catalog (`public/api/model-catalog.json`) now includes audio and lip-sync pools.

## API layer

| Upstream call | Ours | Status |
|---|---|---|
| motion-graphics, motion-graphics-edit | `runMotionGraphics`, `runMotionGraphicsEdit` | ADDED (live endpoint unverified) |
| Marketing Studio ad (Seedance 2 omni-reference) | `generateMarketingStudioAd` | ADDED (live endpoint unverified) |
| history, delete media | `getHistory`, `deleteMedia` | ADDED (not yet merged into Library UI) |
| calculate_dynamic_cost, estimate-cost | `calculateDynamicCost`, `estimateV2VCost` | ADDED (no UI cost line yet) |
| app/interest(s) | `registerAppInterest`, `getAppInterests` | ADDED — needs `muapi-proxy` redeploy |

## Per-studio status

| Studio | Added from upstream |
|---|---|
| Image | Face-swap slot, batch stepper in every mode, effect-type picker, attachment strip, Draw / sketch modal (pencil, eraser, rectangle, arrow, text, undo/redo; reference image or hand-off to Video as a start frame), remembers model + aspect ratio |
| Video | Attachment strip (start/end frame, references, audio), Extend / 4K from the result menu for every compatible model (Seedance, Veo 3.1, Grok), Source / workflow menu (text, animate image, keyframes, references, edit, extend, motion transfer), V2V cost estimate, sketch hand-off |
| Cinema | Attachment strip, Image/Video output toggle (stills at 1K/2K/4K, persisted), drop an image on the start tile |
| Lip Sync | Drag-drop onto upload buttons, in-slot audio play/pause, upload progress % |
| Audio | Premium player (volume, mute), page-wide drop |
| Effects | Motion graphics tab: Generate / Edit / Remix |
| Commercial | Ad-video mode: avatars, formats, references |
| Influencer | Builder Reset, "Generated · N characters" history column |
| Apps | Template apps, GitHub/Demo links, interest modal |
| Library | Server history (`getHistory`) merged with local history |

Best-effort, unverified against a real key: V2V cost line (`estimateV2VCost`) and server history merge —
both hide themselves on any error. Upstream itself only calls `estimateV2VCost`; `calculateDynamicCost` is
defined there but unused by any studio, so it stays an API-layer function.
