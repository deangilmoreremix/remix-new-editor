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

## Model catalog (Phase 1 — PLANNED)

| | Upstream | Ours |
|---|---|---|
| Text to image | 84 | 48 |
| Image to image | 88 | 55 |
| Text to video | 108 | 43 |
| Image to video | 176 | 60 |
| Video to video | 75 | 7 |
| Audio | 22 | 6 |
| Lip sync | 15 | 9 |

Upstream counts include resolution variants. Notable missing families:
Ideogram 4, Nano Banana 2.1, GPT Image 2/2.5, Midjourney v7/v8, Seedream 5,
Seedance 2.5, Vidu Q4, Veo 4 / 3.1 lite·4K·extend, Kling 3.0 Omni/Turbo,
MiniMax H3, Wan 3.0, LTX 2.5, PixVerse v6, Runway Aleph / Act-Two,
ElevenLabs v4, Fish S2.1, Lyria 3, Gemini TTS, OmniHuman 1.5.

## Per-studio gaps (Phase 3 — PLANNED)

| Studio | Gap |
|---|---|
| Image | Draw / sketch reference; face-swap input slot |
| Video | References, edit-video, extend-uploaded-video and motion-transfer modes; extend for every compatible model (not just Seedance); audio input slot; draw reference |
| Effects | Motion-graphics generate, edit-previous-result, "Remix this" (depends on MuAPI motion-graphics endpoints being available) |
| Commercial | Ad-video mode (product + avatar + script), avatar presets, duration / resolution |
| Apps | GitHub / demo links; "request this app" |
| Lip Sync | OmniHuman 1.5 and Volcengine models (via Phase 1) |
| Influencer | Confirm Shuffle |
