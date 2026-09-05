# Video Agent / OpenChatCut Integration — Baseline Audit

This document records the repository state BEFORE any Video Agent / OpenChatCut
integration work. It exists to make any future regression against the Timeline
Studio or unrelated SmartVideo functionality immediately obvious.

---

Strategy: Video Agent Studio 2 is the **complete OpenChatCut
application** (from `deangilmoreremix/OpenChatCut`) imported as a
`git subtree` at `apps/video-agent-studio/` and embedded as an
**iframe** in the SmartVideo shell at the new
`video-agent-studio` route. SmartVideo provides only the route, the
SmartVideo-branded chrome, the navigation entry, and the
dev/build scripts. OpenChatCut provides everything else — its own
backend, project store, media processing, agent runtime, MCP,
FFmpeg, Remotion, etc. No timeline, media, project, generation, or
export command crosses the iframe boundary.

The user-facing distinction is:

```text
Timeline Studio        — "I want to manually edit my video."
Video Agent Studio 1   — existing /video-agent route, the original AI tools grid
Video Agent Studio 2   — new /video-agent-studio route, the complete OpenChatCut app
```

## 1. Repository & branch baseline

| Field | Value |
| --- | --- |
| Repository | `deangilmoreremix/remix-new-editor` |
| Working copy | `.kilo/worktrees/alive-barn` |
| Feature branch created | `feature/video-agent-openchatcut` |
| Branch base (current) | `reconcile/timeline-studio` |
| Tracked upstream | `origin/develop` |
| **Baseline SHA** | **`3a8b5ee28a04a7ee5dae95e6b824b351589c8b58`** |
| Baseline commit subject | `test(timeline): add SAM3 browser coverage and selector fixes` |
| `develop` tip (reference) | `1b9cb241438116e745824ab0cdd1a937b49c6019` |
| Pre-existing untracked file | `tests/e2e/public-audit-report.spec.js` (preserved untouched) |

The branch `feature/video-agent-openchatcut` is forked from the worktree's
current branch (`reconcile/timeline-studio`) and is identical to SHA
`3a8b5ee28` at the moment of branch creation. No commits, resets, force-pushes
or rebases have been performed against the parent branch. No file in
`src/components/TimelineEditorPage.jsx`, `src/lib/editor/timelineFeatureApi.js`,
or any Timeline Studio entry point has been modified, removed or downgraded.

---

## 2. Current route surface (`src/lib/router.js`)

| Route key | Page module | Purpose |
| --- | --- | --- |
| `video-agent` | `src/components/VideoAgentPage.js` | **Video Agent Studio 1 (the original). NOT touched by this work.** |
| `video-agent-studio` | `src/components/VideoAgentStudioShell.js` (NEW) | **Video Agent Studio 2 — the new OpenChatCut-backed editor.** |
| `timeline` | `src/components/TimelineEditorPage.jsx` | **Existing SmartVideo Timeline Studio — must remain untouched.** |

Other studio routes (image, video, cinema, apps, templates, effects,
edit, upscale, library, character, influencer, commercial, explore,
avatar, audio, training, videotools, chat, lipsync, leadfinder,
personalizer, assist, community, storyboard, text-to-image,
image-to-image, text-to-video, image-to-video, video-to-video,
video-watermark, storyboard-page, character-page, effects-page,
cinema-page, influencer-page, commercial-page, upscale-page,
render, director, ai-vfx, viral, brand, brand-dna, campaign,
campaign-page, asset-edit, photo-studio, brand-photo-studio,
animate) — all unchanged and **must remain intact**.

Notes:
* The `video-agent` route is the user-facing entry for the original
  Video Agent Studio 1. It MUST continue to load
  `src/components/VideoAgentPage.js` exactly as it does today.
* The new `video-agent-studio` route is the user-facing entry for
  Video Agent Studio 2 (the OpenChatCut-backed editor). It loads
  the new shell, which embeds the upstream app from
  `apps/video-agent-studio/`.
* The two routes are **independent**. Each loads a different
  implementation with its own state system. The two editors do not
  share a mutable timeline store.

---

## 3. Current Video Agent Studio 1 (smart side)

Located at `src/components/VideoAgentPage.js` (≈1.4k lines).
High-level responsibilities:
* Hero / banner / branding header.
* Local video upload via Supabase (`uploadMediaFile`).
* Pexels sample video picker.
* Categorized AI tools grid (perceive / storyboard / generate / voice /
  localize / edit / connect).
* Processing queue UI.
* "Run full pipeline" CTA.
* Cancel/abort handling.
* Per-tool call into:
  * `getBackendBase()/videoagent/process` (Express)
  * with Supabase Edge Function fallback at `${SUPABASE_URL}/functions/v1/videoagent`.
* Entitlement check via `requireEntitlement()` from Clerk entitlements.

Existing AI tools enumerated in the file:

* Scene Detection
* Highlight Detection
* Visual Search
* Keyword Search & Compilation
* ImageBind
* Subtitle Agent (Whisper)
* Profanity Remover
* Automated Video Highlights
* Storyboarding Agent
* Text-to-Movie
* Text-to-Video
* Kids Storyteller
* Faceless Video Creator
* AI Ad Films
* TikTok Lyric Videos
* Year in Frames
* Trailer Narration
* CosyVoice
* Fish Speech
* Seed-VC
* Whisper
* Voice Cloning Agent
* Gen AI Audio Overlays
* AI Voiceovers
* Dubbing Agent
* Multi-Language Dubbing
* Clip Segmentation
* Color Correction
* Video Upscale
* Stabilize
* Intro / Outro
* Brand Elements
* Dynamic Ads
* Intelligent Output Formatting
* Sales Assistant Agent (CRM)
* Slack Agent
* Thumbnail Agent
* Comparison Agent

Use cases (smart side): Stand-up Comedy, Commentary, Video Overview, Meme
Generator, Music Video, Video Q&A.

These capabilities are mapped in
`docs/audits/VIDEO-AGENT-OPENMONTAGE-MIGRATION-MATRIX.md` and
`docs/video-agent/SMARTVIDEO-INTEGRATIONS.md`.

---

## 4. Timeline Studio (protected surface)

| Entry | Path | Notes |
| --- | --- | --- |
| Route loader | `src/lib/router.js` → `timeline: () => import('../components/TimelineEditorPage.jsx')…` | **Do not change.** |
| Page module | `src/components/TimelineEditorPage.jsx` (7 066 lines) | **Do not replace, move or rewrite.** |
| State engine | `src/lib/TimelineEngine.js` (254 lines) | **Do not replace.** |
| Public API | `src/lib/editor/timelineFeatureApi.js` (`TimelineFeatureApi`) | **Authoritative for Timeline Studio. Not replaced by OpenChatCut.** |
| Tests | `src/lib/editor/__tests__/timeline-feature-api.test.js` | Must continue to pass. |
| Modal surface | `src/components/modals/TemplateGeneratorModal.jsx` and 100+ other modals | Existing toolchain remains intact. |

The Timeline Studio is the "manual" editor inside SmartVideo. OpenChatCut
becomes the AI-native editor behind the `video-agent` route. **The two
editors do not share mutable state.**

---

## 5. Existing OpenMontage integration (reference source — not the engine)

| File | Path | Status |
| --- | --- | --- |
| Front-end page | `src/components/OpenMontagePage.js` (1 389 lines) | Reference / migration source. **Do not delete in this work.** |
| Backend proxy | `backend/services/openmontageProxy.js` | Reference. **Do not delete in this work.** |
| Vendor code | `vendor/openmontage/` | Reference. **Do not delete in this work.** |

OpenMontage is treated as architectural reference for the future Producer
mode (Phase 14). It is **not** promoted to the editor engine. See
`docs/audits/VIDEO-AGENT-OPENMONTAGE-MIGRATION-MATRIX.md` for the per-feature
disposition.

---

## 6. Existing SmartVideo generation infrastructure

| Capability | File(s) | Notes |
| --- | --- | --- |
| MuAPI client (browser) | `src/lib/muapi.js`, `src/lib/muapiKeyValidator.ts` | Shared provider key/secret layer. |
| MuAPI proxy (server) | `backend/services/agentActionsService.js` (uses `MUAPI_API_KEY`/`MUAPI_BASE_URL`) | Provider key never reaches the browser. |
| Model registry (client) | `src/lib/modelCatalog.js`, `src/lib/models.js`, `src/lib/modelDescriptions.js`, `src/lib/modelComparisonData.js`, `src/lib/modelInputExtensions.js`, `src/lib/modelPickerIntegration.js`, `src/lib/modelSelectorUI.js` | Authoritative client-side catalog. The new Video Agent generation adapter MUST resolve through this layer, not duplicate it. |
| Model catalog (server) | `backend/services/modelCatalogService.js` | Authoritative server-side catalog. |
| Existing studios (still protected) | `ImageStudio.js`, `VideoStudio.js`, `CinemaStudio.js`, `EffectsStudio.js`, `AvatarStudio.js`, `AudioStudio.js`, `LipSyncStudio.js`, `InfluencerStudio.js`, `CommercialStudio.js`, `CharacterStudio.js`, `BrandStudio*.js`, `LeadFinderStudio.js`, `TrainingStudio.js`, `SmartVideoScheduler.js`, `SmartVideoViral.js`, `ChatStudio.js`, `CinemaTemplateStudio.js`, `StoryboardStudio.js`, `StoryboardPage.js`, `TemplatesPage.js`, `AppsHub.js`, `VideoToolsStudio.js`, `RenderPage.js`, `LibraryPage.js`, `UpscaleStudio.js`, `UpscalePage.js`, `BrandDnaEditor.js`, `AssetCanvasEditor.js`, `CampaignWizard.js`, `CampaignPage.js`, `PhotoStudioPage.js`, `AnimatePage.js`, `AIVFXPage.js` | All remain intact. |
| `apps/ai-vfx` (isolated Next.js studio) | `apps/ai-vfx/` | Already a structurally isolated SmartVideo sub-app. **Pattern reference for `apps/video-agent-studio`.** |

---

## 7. Existing auth, credits, storage, and publishing infrastructure

| Concern | File(s) | Notes |
| --- | --- | --- |
| Auth (Clerk) | `src/lib/clerkInit.js`, `src/lib/clerkEntitlements.js`, `src/lib/devAuth.js`, `backend/server.js` | Authoritative. Phase 7 builds a clean auth bridge that derives the user from the SmartVideo Clerk session, not from browser-supplied `userId`. |
| Backend Express | `backend/server.js`, `backend/routes/chat.js`, `backend/middleware/*` | Authoritative HTTP surface for Video Agent. |
| Storage (Supabase Storage / R2 / hybrid) | `src/lib/hybrid-supabase.js`, `src/lib/supabase.js`, `src/lib/offline-storage.js` | Authoritative. Phase 9 builds a `video-agent/{userId}/{projectId}/{assetId}` adapter on top. |
| Database (Supabase) | `supabase/migrations/*` (incl. core tables, projects, generations, usage & billing, multi-tenant schema) | Phase 8 adds `video_agent_*` tables without altering unrelated tables. |
| Credit / billing | Existing usage & billing tables under `supabase/migrations/*` + backend metering | Authoritative. Phase 12 uses `estimate → reserve → execute → reconcile`. No parallel credit system. |
| Social publishing | Existing SmartVideo Social Publisher routes/studios | Phase 16 reuses the existing publisher rather than building a duplicate. |
| Realtime | `backend/websocket/chat.js`, `socket.io-client` | Phase 21 prefers SSE / the existing realtime transport for Video Agent events. |

---

## 8. Files that MUST NOT be removed, renamed, or downgraded

The following files are the protected surface. Any modification is a
regression unless explicitly approved by the migration matrix.

* `src/components/TimelineEditorPage.jsx`
* `src/lib/editor/timelineFeatureApi.js`
* `src/lib/TimelineEngine.js`
* `src/lib/editor/__tests__/timeline-feature-api.test.js`
* `src/lib/router.js` (the `timeline` entry — the `video-agent` entry will be
  rewired to load the new studio, but the route key remains `video-agent`)
* All `src/components/*Studio.js` and `src/components/*Page.js` files other
  than `VideoAgentPage.js`
* `src/components/OpenMontagePage.js`
* `vendor/openmontage/`
* `backend/services/openmontageProxy.js`
* `src/lib/muapi.js`, `src/lib/muapiKeyValidator.ts`,
  `src/lib/modelCatalog.js`, `src/lib/models.js`
* `src/lib/clerkInit.js`, `src/lib/clerkEntitlements.js`, `src/lib/supabase.js`
* `apps/ai-vfx/` (whole subtree)
* `supabase/migrations/*` (existing)
* `backend/server.js`, `backend/routes/*`, `backend/services/*` (existing)
* `package.json`, `package-lock.json`, `vite.config.js`, `vitest.config.js`,
  `tsconfig.base.json` (no downgrade allowed to satisfy OpenChatCut)
* `src/components/VideoAgentPage.js` (its identity is preserved — it is
  turned into the integration shell, not deleted)

---

## 9. Build / test / lint baseline status

At the time of branch creation:

* `npm run build` — not re-run during this audit (no edits made). The
  baseline inherits whatever state the previous CI on
  `reconcile/timeline-studio` produced. This is recorded as the
  pre-integration baseline.
* `npm run lint` — not re-run (no edits made).
* `npm test` — not re-run (no edits made).

Re-baselining of build/lint/test output will be done at the end of each
phase, in a separate "verification" step (see
`docs/video-agent/TESTING.md`).

---

## 10. Target integration shape (summary)

```
SMARTVIDEO
├── Timeline Studio (existing, untouched)
└── Video Agent Studio (NEW — OpenChatCut-derived)
        └─ apps/video-agent-studio/  (isolated)
              ├─ agent/
              ├─ editor/
              ├─ transcript/
              ├─ captions/
              ├─ audio/
              ├─ generate/
              ├─ export/
              ├─ gl/
              ├─ components/
              ├─ server/
              ├─ remotion/
              ├─ desktop/
              └─ package.json  (own dependency boundary)
```

The Video Agent Studio keeps its own `ProjectDoc` (OpenChatCut's
authoritative project model). It is bridged to SmartVideo auth, storage,
models, credits, publishing and (eventually) Timeline Studio via narrow
adapters. The Timeline Studio's state and `TimelineFeatureApi` are never
replaced or merged.

---

End of baseline audit.
