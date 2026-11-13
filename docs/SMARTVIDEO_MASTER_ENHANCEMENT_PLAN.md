# SmartVideo AI — Master Enhancement Plan & Stage 0 Audit

Status: **Stage 0 (audit-only) complete.** Stages 1–12 are NOT authorized. Authorization is by explicit user instruction only (see `SMARTVIDEO_STAGE_STATUS.md`).

Branch: `claude/jolly-cannon-ofqf7h`. No application code, dependency, migration or deployment was changed in Stage 0.

## 0. Rules in force for every stage
- Execute exactly one authorized stage, test it, commit to the feature branch, write the Stage Completion Report, STOP.
- No new database/renderer/player/publishing system/always-on server/paid API. Reuse Netlify, Supabase, browser processing, Remotion.
- **Remotion Recorder / recording: out of scope** — being completed in a separate session. Not audited here; later stages may consume recorded media only through the existing media library once that work lands.
- Preserve RLS, SSRF protections, entitlements; no fabricated results.

## 1. Existing feature audit (paths verified by exploration, not by running the app)

| # | System | Where | State |
|---|---|---|---|
| 1 | Timeline Editor (default `#/timeline`) | `src/cinegen/` (`components/edit/timeline-editor.tsx`, `lib/editor/playback-engine.ts`, `lib/occ/*`, IndexedDB `remix-cinegen-web` via `adapters/web-store.ts`) | Real; ~198 tests under `src/cinegen/__tests__` |
| 1b | Classic editor `#/timeline-classic` | `src/components/TimelineEditorPage.jsx` (~10k lines), `src/lib/editor/*` | Real; legacy home of many features |
| 2 | Personalization Modal | `src/features/personalization/shared/personalization/PersonalizationModal.tsx`, `DemoPersonalizeProvider.tsx`, `guided/*`, `advanced/*`, `image-editor/*`, `preview/PersonalizationComposition.tsx`, `supabaseProjectPersistence.ts`, `personalize/tokenSchema.js` | Real. Opened via `openPersonalization()` (`features/personalization/mount.jsx`) from studios; **not** reachable from the timeline (stub, see §5) |
| 3 | Business/Lead Finder | `netlify/functions/_businessDiscovery.js`; `_personalization/app/api/personalization/find-businesses/route.ts`; `src/components/LeadFinderStudio.js`; table `lead_finder_leads` | Real (Overpass/Nominatim) |
| 4 | Asset Finder | `_personalizationAssets.js`, `personalization-discovery.js`, `src/components/personalize/discovery/*`, `PersonalizationHubPanel.js`, `DiscoveredAssetGrid.tsx` | Real; job state in-process |
| 5 | Website screenshots | `_personalization/src/server/browserDiscovery.ts` (`capturePageScreenshots`, Playwright + `@sparticuz/chromium`), `motion-studio-capture-background.mts`, `/api/motion-studio/capture`, bucket `motion-capture` | Real |
| 6 | Remotion compositions | `src/lib/editor/remotion/` (`TimelineComposition.jsx`, `timelineToComposition.js`, …); personalization designs in `shared/personalization/templates/designs/` (~30); Motion Director `apps/motion-director/`; `remotion-composer/` (OpenMontage CLI project, not in app build) | Real |
| 7 | Remotion Web Renderer | `src/lib/editor/remotion/exportClient.js` → sandboxed `export-runner.html` (`src/export-runner/main.jsx`, `renderMediaOnWeb`); personalization `webExport.ts`/`finalOutput.ts`; `apps/motion-director/webRenderer.ts` | Real, client-only (no server render) |
| 8 | Remotion Recorder | — | **Skipped per user** |
| 9 | Thumbnail Studio | `src/components/modals/TemplateThumbnailModal.jsx` (~4.2k lines) + `src/lib/thumbnail*.js` | Real but AI-image generation only; no standalone page, no canvas/layer editor |
| 10 | GIF encoding | `src/lib/gifEncoder.js` (hand-written, 1 caller) | **Defective** (§5) |
| 11 | Media library | `src/lib/assetLibrary.js` (Supabase `media` + bucket `uploads`); `src/lib/assets/*`; `lib/editor/mediaLibrary.js`; CineGen workspace store; personalize stores | Real but fragmented (4+ stores) |
| 12 | Email campaign UI | `src/components/modals/EmailCampaignModal.jsx` | **Simulated** (§5) |
| 13 | React Flow | `src/cinegen/components/create/workflow-canvas.tsx`, `lib/workflows/{node-registry,execute,topo-sort}.ts` | Real; media-generation nodes. No outreach/publish nodes |
| 14 | Publishing | `src/lib/editor/publish/publishClient.js`, `sharePanel.js`; tables `published_videos` etc.; RPC `get_published_video` | Real |
| 15 | Watch pages | `src/pages/WatchPage.jsx`, `interactivePlayer.js`, `netlify/edge-functions/watch-embed.js`, `watch-voice.js` | Real; personalization by query params |
| 16 | Analytics | `netlify/functions/video-events.js`, `20261112020000` migration (sessions/events/daily), owner RPCs | Real, DB-backed |
| 17 | Retargeting | `20261112030000` migration, `retarget_*`, `viewer_interests`; UI in `projectLibrary/projectTabs.js`, `cinegen/components/analytics/` | Real; recommends only, never contacts viewers |
| 18 | Notifications | `src/lib/notificationsBell.js` + `owner_notifications`; `digest-daily.mjs` | In-app only; email queue has no provider |
| 19 | Supabase storage/RLS | buckets `uploads`, `personalization-assets`, `brand-assets`, `motion-capture`, `wb-deployments` (public read); RLS on all audited tables | See §7 |
| 20 | Netlify Functions | see list in §7 | |
| 21 | Browser storage/recovery | `src/lib/editor/persistence.js` (localStorage→IndexedDB→Supabase, 1.5 s debounce, 10 versions, beforeunload flush); personalization `ResumeProjectBanner` | Real; no general crash-recovery prompt found; contacts/leads are localStorage-only |
| 22 | React deps | React 19.2.7, Vite 5, Remotion 4.0.540 (+ web-renderer, player, transitions, effects, captions, lottie…), `@xyflow/react`, `react-dropzone`, `mediabunny`, `@ffmpeg/ffmpeg`, `wavesurfer.js`, `gl-transitions`, `idb-keyval`, `three`, `gsap`, `zustand`, `xstate` | |
| 23 | Web APIs in use | see §2 | |
| 24 | Effects/captions/audio/MG | `@remotion/effects` + OpenChatCut GL fx/LUTs (`src/openchatcut/gl`); captions in `remotion/captions.js` and `src/openchatcut/captions/*`; audio analysis in `src/openchatcut/audio/{beats,loudness,silence}.ts`; MG templates `cinegen/lib/occ/mg-templates.ts`; transitions `openchatcut/gl/transitions.ts` + `remotion/transitionMap.js` | Real. **No teleprompter exists.** No audio-mixer package |

Two overlapping personalization backends: legacy `personalizer-api.js`/`intelligence-api.js` (Supabase Auth, `auth.uid()` RLS) vs ported `personalization-api.mts` (Clerk JWT, `auth.jwt()->>'sub'` RLS). The browser UI still calls the legacy routes for contacts.

## 2. Browser API opportunity matrix
Legend: **Used** = real code today; **Rec** = recommend (stage); **Skip** = not worth it.

| API family | Existing use | Recommendation / notes |
|---|---|---|
| Canvas / OffscreenCanvas | Used (`gifEncoder.js`, `video-frame-worker.js`, `alphaVerification.ts`, `bgRemoval.js`) | Rec: Stage 1 (Konva), 7 (thumbnails/GIF). Works in worker; Remotion output unaffected |
| WebGL2 | Used (`openchatcut/gl/runtime.ts`, `glTransitionRenderer.js`) | Rec: Stage 5. Preview-only effects must be tested in actual Remotion export |
| WebGPU | ML device selection only (`ml.worker.js`, `bgRemoval.js`) | Skip for effects (Chromium-only); keep for ML with WASM fallback |
| WebCodecs | Indirect (mediabunny, mp4box, web-renderer); `VideoEncoder` feature-detected | Rec: Stage 6/7 via existing libs; direct use only for frame extraction. Chromium/Safari 16.4+; no Firefox encode |
| Media Capabilities | none | Rec: Stage 12 (codec/export capability check). Free, no permission |
| Web Audio / OfflineAudioContext | Used (cinegen playback engine, `openchatcut/audio/*`) | Rec: Stage 4. Preview-only unless mixdown is baked; export parity must be proven |
| AudioWorklet / AnalyserNode | none confirmed | Rec: Stage 4 (meters/ducking). Needs worklet file served same-origin |
| WebVTT / TextTrack | WebVTT text export only (`subtitleExporter.js`); no TextTrack | Rec: Stage 6 (import/export). TextTrack optional |
| Web Speech (recognition) | none; `speechSynthesis` in one file | Rec: Stage 6 only for teleprompter following; Chrome-only, sends audio to vendor — **disclose**; do not claim transcription (Whisper worker already exists in `remotion/transcribe.js`) |
| IndexedDB | Used widely (idb-keyval, raw) | Used; Stage 12 hardening |
| OPFS / Storage API | none | Rec: Stage 12 (temp media, quota warnings). Safari/Firefox support OPFS; `storage.estimate` is approximate |
| File API / Streams | File API used; Streams not noted | Rec: Stage 12 large-file streaming |
| Compression Streams | none | Rec: Stage 12 project archive (gzip). Zip container needs a small lib or hand-rolled |
| Web Workers | Used (export, ML, transcribe, media worker) | Rec: Stage 12; fix `performanceManager.js:585` dev-only worker URL |
| Web Animations / View Transitions | none | Skip (Remotion drives animation; VT is cosmetic) |
| Clipboard | Used (~30 files) | Used |
| Drag & Drop / Pointer Events | Used (~80 / ~50 files; dnd-kit, interactjs) | Used; Stage 1 reuses Pointer Events |
| EyeDropper | none | Low value; optional in Stage 1 colour picker (Chromium-only) |
| Font Loading | Used (`openchatcut/fonts/localFonts.ts`) | Used; Stage 1 font styling |
| WebRTC | voice assistant only | Skip |
| WebSocket / SSE | Used by unrelated features | Skip for this roadmap (no always-on server allowed) |
| Broadcast Channel / Web Locks | none | Rec: Stage 12 multi-tab sync + edit locks. Widely supported |
| Web Share | none | Skip (marginal; clipboard exists) |
| Web Crypto | Used (ids, hashing) | Used; Stage 8 tokens must be **server**-generated (`crypto.randomBytes`) |
| Permissions | none | Rec: Stage 11 push permission state |
| Performance APIs | partial | Rec: Stage 12 diagnostics |
| ResizeObserver / IntersectionObserver / Page Visibility | Used | Used; Stage 11 view tracking |
| Beacon | Used (`analytics.js`, `publish/analyticsClient.js`) | Used |
| Service Workers | `public/sw.js` (Academy cache only) | Rec: Stage 11 push SW — must not disturb Academy caching |
| Push / Notifications / Badging | local `Notification` permission check only | Rec: Stage 11. **Push needs VAPID keys + a sender (Netlify function)**; iOS requires installed PWA; Badging Chromium-only |
| Fullscreen / PiP | Used (modals, WatchPage) | Used |
| Wake Lock | none | Skip (low value) |
| Barcode Detection | none | Skip (no use case) |
| Geolocation | none | Skip (Lead Finder uses geocoding by text) |
| Browser built-in AI | none | Skip (experimental) |
| File System Access pickers | none | Skip (Chromium-only; `<a download>` suffices) |

## 3. React library compatibility report
No library below is installed except where stated. **Licences must be re-verified from each package's own LICENSE at install time in its stage; the table records expectations only, not verified facts.**

| Library | Installed? | Use | Fit |
|---|---|---|---|
| React Konva / konva | No | Stage 1 canvas editing | Fits React 19? Verify peer range at install. Gives drag/resize/rotate/snap; **Konva output must be serialised to the existing `PreviewInputProps` layers** so Remotion renders identically — Konva is editor chrome only |
| React Easy Crop | No | Stage 1 crop | Small; yields crop rect to apply in Remotion/CSS |
| gifenc | No | Stage 7 | Justified: current `gifEncoder.js` is defective. Alternative is fixing in-house; decide in Stage 7 |
| React Flow (`@xyflow/react`) | **Yes** | Stage 10 | Reuse existing canvas + `execute.ts` |
| React Grid Layout | No | Stage 11 | Optional; only if widget layouts kept |
| visx | No | Stage 11 | Charts; needs React 19 peer check |
| React PDF | No | Stage 11 | Browser PDF; large; lazy-load |
| React Dropzone | **Yes** (`MediaDropzone.jsx`) | Stage 9/10 CSV/media | Reuse |
| Plate | No | — | **Not recommended**: overlaps email editor, heavy |
| React Email | No | Stage 9 | Evaluate `@react-email/*` render + editor at stage start; HTML export for email clients |
| MediaPipe tasks-vision | Only `apps/video-agent-studio` | Stage 3 | Root app has none; verify model + code licence (Apache-2.0 expected, unverified) |

## 4. Existing code to reuse (by stage)
- Stage 1: `PersonalizationModal.tsx`, `preview/{types.ts,PersonalizationComposition.tsx,PersonalizationPlayer.tsx}`, `supabaseProjectPersistence.ts`, `editedAssetPersistence.ts`, `webExport.ts`, `tokenSchema.js`, `image-editor/MaskEditor.tsx`, `lib/personalization/maskEditor.js`.
- Stage 2: `_businessDiscovery.js`, `networkSafety.ts`, `browserDiscovery.ts`, `/api/motion-studio/capture`, `DiscoveredAssetGrid.tsx`, Remotion layers.
- Stage 3: `remotion/bgRemoval.js`, `ml/videoMatte.js`, `shared/personalization/alphaVerification.ts`.
- Stage 4: `openchatcut/audio/*`, `cinegen/lib/occ/{analysis,export-qa}.ts`, `playback-engine.ts`.
- Stage 5: `remotion/effects.js`, `openchatcut/gl/*`, `transitionMap.js`.
- Stage 6: `remotion/captions.js`, `openchatcut/captions/*`, `subtitleExporter.js`, `transcribe.js`.
- Stage 7: `TemplateThumbnailModal.jsx`, `thumbnail*.js`, `gifEncoder.js` (replace/fix).
- Stage 8: `publishClient.js`, `WatchPage.jsx`, `lead-capture`, `video-events.js`, owner RPCs.
- Stage 9: `EmailCampaignModal.jsx` (replace simulation), `emailAdapter.js`.
- Stage 10: `workflow-canvas.tsx`, `execute.ts`, `personalization_discovery_jobs`, `ContactImporterModal.js`.
- Stage 11: analytics RPCs, `notificationsBell.js`, `digest-daily.mjs`, `public/sw.js`.
- Stage 12: `persistence.js`, `performanceManager.js`, `serverExportRecoveryStore`.

## 5. Broken or incomplete functionality (evidence-based; not runtime-verified in Stage 0)
1. **Email sending is simulated.** `EmailCampaignModal.jsx` runs a fake progress bar and `onConfirm({action:'campaignSent'})`; segments hardcoded. `_shared/emailAdapter.js` returns a NOOP adapter. No Resend/SendGrid/etc. code exists.
2. **Recipient identity is forgeable.** Personalized links use `?c=<contactId>` (regex-validated only) passed unauthenticated to `video-events`/`watch-voice`; no signed token or recipient table; contact↔video ownership not checked.
3. **`gifEncoder.js` defects** (from code reading): `drawImage` before `Image.onload`; palette from frame 0 but per-frame index maps from each frame's own quantisation; exact-colour top-256 quantiser; `push(...bigArray)` can overflow the stack; no disposal/transparency.
4. **Timeline Personalization stubs:** `src/main.js` (~L390) shows "not available in this build"; `TokenEditor.jsx` inert; `VideoPersonalizationHub` `onComplete` is a no-op in `timeline-editor.tsx` (~L978).
5. **Missing workspace packages:** root `package.json` declares `file:packages/*` for `@higgsfield/{audio-mixer,color-grading,style-templates,subtitles,transitions,video-compiler}`; those directories don't exist; `vite.config.js` aliases them anyway. No lockfile.
6. `performanceManager.js:585` constructs `new Worker('/src/lib/editor/renderWorker.js')` — a dev-server path likely broken in production.
7. Public anonymous Lead Finder routes (`find-businesses`, `research-business`, `resolve-website`) rely on per-instance in-memory rate limits; same for `watch-voice`, `lead-capture`, `create-share`.
8. Weak-identity edge functions: `ai-cinematic-prompt-generator` (JWT payload decoded without signature verification), `generation-history` (`x-user-key`), `create-share` placeholder CORS origin; `frame-agent`/`videoagent` CORS `*` with no auth seen.
9. Legacy `isPrivateIpv4` in `_personalizationAssets.js` omits ranges (e.g. CGNAT 100.64/10) that `networkSafety.ts` blocks.
10. Discovery job state is in-process; cold instance returns `unknown` and client must resubmit.
11. Contacts/leads/profiles live in localStorage only (`remix_contacts`…) — lost on clearing site data; not synced.
12. `video-events` falls back to a default hash salt if `ANALYTICS_HASH_SALT` unset; limiter fails open.
13. Stale comment: `motionCapture.ts:9` cites a non-existent migration (bucket is in `20261102000000`).
14. Duplicate project-persistence exports (`supabaseProjectPersistence.ts` vs `projectRestore.ts`); duplicate asset stores (`assetLibrary.js` vs `assetStore.js`).
15. `SENDSPARK_FEATURES_COMPARISON.md` is stale (lists analytics as missing; calls email complete).

## 6. Missing features (relative to the target workflow)
Canvas/layer editor; crop; website scroll/cursor animation; MediaPipe segmentation in root app; audio mixer/ducking UI + export parity proof; teleprompter; scene-change detection; automatic thumbnail extraction & best-frame; reliable GIF; secure recipient tokens & per-recipient URL table; CTA/lead interaction wiring on personalized pages; real email provider + unsubscribe/suppression; React Email templates; CSV bulk pipeline + resumable batch jobs; React Flow outreach nodes; Web Push; dashboard widgets & PDF reports; OPFS/Locks/BroadcastChannel/archive export.

## 7. Architecture limitations
- **Rendering is browser-only** (Remotion web renderer in a sandboxed iframe). No unattended server render ⇒ "batch MP4" is a *browser-session* job; Stage 10 must label it so. Server-reliable unattended ops are limited to Netlify Functions (incl. background ≤15 min) + Supabase + scheduled functions (`digest-daily.mjs` pattern).
- **Netlify Functions:** `personalization-api.mts`, `personalization-discovery.js`, `personalization-browser-discovery.cjs`, `motion-studio-capture-background.mts`, `personalizer-api.js`, `intelligence-api.js`, `video-events.js`, `watch-voice.js`, `digest-daily.mjs`, `supabase-token.js`, `clerk-webhook.js`, `website-builder-*`, AI proxies (`cinegen`, `timeline-*`, `video-agent*`, `agent-audio`, `workbench-chat`), `pexels.js`, `pixabay.js`. Edge: `watch-embed.js`. Supabase edge: `lead-capture`, `process-upload`, `ai-thumbnail-generator`, `ai-cinematic-prompt-generator`, `generation-history`, `create-share`, `muapi-*`, `frame-agent`, `videoagent`.
- **Dual auth** (Supabase Auth vs Clerk) with divergent RLS keys; any new table must pick the Clerk `sub` convention and state it.
- **Public buckets** (`personalization-assets`, `brand-assets`, `motion-capture`): confidentiality depends on unguessable paths — unsuitable for private prospect data.
- In-memory limiters aren't shared across instances; use the `rate_limit_check` RPC for new public endpoints.
- Three overlapping editors; CineGen is the default and should be the integration target.
- Email delivery requires a provider + secrets stored server-side; none configured in-repo.

## 8. Browser compatibility risks
WebCodecs encode (no Firefox); WebGPU (Chromium/Safari TP); Web Speech recognition (Chrome, vendor-hosted); EyeDropper/Badging (Chromium); Push on iOS (installed PWA only); OPFS (OK on modern engines; Safari workers-only sync handles); AudioWorklet requires secure context; MediaRecorder codecs vary (not audited). Remotion web-renderer capability depends on `canRenderMediaOnWeb` — existing code already gates on it.

## 9. Licence considerations (to be confirmed by the user's counsel; not legal advice)
- Repo `LICENSE` is **AGPL-3.0**; `src/openchatcut/NOTICE.md` says the app must be offered under AGPL-3.0-or-later (vendored OpenChatCut). `src/cinegen` vendored under MIT.
- **Remotion** is source-available under its own licence; code comments assume the Free License (≤3-person companies). Commercial use by larger teams needs a company licence — **confirm before any commercial rollout**.
- Not verified here (no `node_modules`/network package inspection): licences of mediabunny, wavesurfer, gsap, transformers.js, MediaPipe, and every candidate library in §3. Each stage must verify before adding a dependency.
- Third-party content: Overpass/Nominatim usage policies (rate limits, attribution), scraped website assets (copyright/ToS), Pexels/Pixabay terms — attribution fields should be preserved.

## 10. Recommended implementation order
Follow Stages 1→12 as specified, with these prerequisites pulled forward **within** their stages:
1. Stage 1: pick CineGen/Personalization Modal as the single integration point; wire timeline stub or document it.
2. Stage 2 before 7 (website imagery feeds thumbnails).
3. **Stage 7 first task:** replace/fix GIF encoder with a real-output test (decode the produced GIF, assert frame count/palette).
4. **Stage 8 first task:** server-side high-entropy recipient token table + ownership checks (needed by 9, 10, 11).
5. **Stage 9 first task:** choose and configure a real provider via a Netlify function (secrets server-side); until then sending stays disabled and labelled, not simulated.
6. Stage 10 only after 8 and 9; Stage 11 push needs VAPID keys; Stage 12 last.
7. Cross-cutting security fixes from §5 items 7–9, 12 are best scheduled with the stage that touches the same surface (8, 10, 11), and need explicit approval since they're outside any single stage's list.

## 11. Baseline test results
See `docs/SMARTVIDEO_STAGE_STATUS.md` §Baseline (filled from commands actually run in this session).

## 12. Features not worth implementing
WebGPU-based effects (Chromium-only; WebGL covers it); WebRTC/WebSocket/SSE product features (no always-on server); Geolocation; Barcode Detection; Wake Lock; Web Share; File System Access pickers; browser built-in AI; View Transitions/Web Animations (Remotion owns animation); Plate editor (React Email editor covers email); native voice-command "assistant" beyond simple optional commands; React Grid Layout/React PDF only if Stage 11 scope keeps widgets/PDF reports (otherwise defer).
