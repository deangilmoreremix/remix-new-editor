# Video Outreach: free browser enhancements, audit and status

Baseline: `develop` at the time of the audit, plus the Video Outreach redesign (PR 339).
Method: read-only code audit of `src/components/OutreachStudio.js`, `src/components/outreach/*`, `src/lib/outreach/*`, `src/lib/recorder/*`, `src/lib/captionStudio/*`, `src/lib/editor/ml/*`, `src/pages/WatchPage.jsx`, `src/lib/push/*`, `netlify/functions/*push*`, `supabase/functions/outreach-alerts`. Nothing here was measured in a live browser; "present" means the code exists and has tests, not that it was exercised on every browser.

Status key: **PRESENT** (exists, covered by tests or by reading the code), **PARTIAL** (exists, with the gap named), **ABSENT**, and in the last column who does the work: **this PR** / **next** / **blocked** (needs a model file, a new dependency licence check, or a backend change).

## 1. The 52 requirements

| # | Requirement | Status | Where it lives today | Gap | Plan |
|---|---|---|---|---|---|
| 1 | Audio quality analyzer | PARTIAL | `recorder/audio.js` (`levelFromSamples`, `clipsInSamples`, `levelHint`, `createLevelMeter`, `recordMicTest`) | No loudness, noise floor or post-take score | next |
| 2 | AudioWorklet gate/limiter/normalizer | ABSENT | Only the pitch worklet in `cinegen` | Needs a processor plus pass-through fallback | next |
| 3 | Local VAD | PARTIAL | RMS silence in `editor/ml/audio.js`, `outreach/mediaTools.js`; Silero in `openchatcut/audio/silero-vad.ts` (not wired) | `@ricky0123/vad-web` not installed; `silero_vad.onnx` missing from `public/models/silero-vad/` | blocked: needs package + model licence check |
| 4 | One-click dead-air removal | PRESENT | `OutreachStudio.js` `editActions.removeSilences`, `outreach/editTools.js` `silencesToCuts`, `videoEdit.jsx` | Energy-based detector (see 3) | done |
| 5 | Face-aware auto framing | PARTIAL | `editTools.js` `ASPECTS`, `resolveAspect`; face reframing exists in `openchatcut/reframe/detect.ts` | No 4:5; centre crop only; no face model file in `public/mediapipe` | next |
| 6 | Eye-contact coaching | ABSENT | none | Needs Face Landmarker model | blocked: model file |
| 7 | Camera gesture controls | ABSENT | none | Needs Gesture Recognizer model; default off | blocked: model file |
| 8 | Record-quality preflight | PARTIAL | `permissions.js`, `devices.js`, `recordMicTest`, `codec.js`, `wakeLock.js` | No single checklist | next |
| 9 | Floating recording monitor (PiP) | PARTIAL | `RecorderModal.jsx` document PiP for the teleprompter | Shows the script, not timer/level/stop | next |
| 10 | Insertable streams / WebCodecs live path | PARTIAL | WebCodecs for export (`captionStudio/burn.js`, `recorder/convert.js`) | Recording stays on MediaRecorder; assess only | next |
| 11 | Existing recording modes preserved | PRESENT | `RecorderModal.jsx` `MODES`, `browserCapture.js`, full recorder | none | done |
| 12 | Accessible responsive recorder | PARTIAL | tablist/aria in `RecorderModal.jsx` | No focus trap, many tooltip-only buttons | next |
| 13 | Local Whisper with consent/progress/cancel | PARTIAL | `captionStudio/transcribeClient.js` `ensureModelConsent`; `makeCaptions` progress + Stop | Native `confirm`, no model picker, no clear-model | next |
| 14 | Caption editing + SRT/VTT/TXT | PARTIAL | `renderCaptionsPanel`, `editActions.captionsFile`, `captionStudio` exporters | TXT not wired; no timing/split/merge | **this PR (TXT)** |
| 15 | Burned-in subtitles | PRESENT | `editTools.js` `CAPTIONS`, `videoEdit.jsx` | Only via Apply edits | done |
| 16 | Translated caption tracks | PRESENT | `translateCaptionsTo`, `editor/ml/localAI.js`, WatchPage language select | Consent UX unchecked | done |
| 17 | Transcript search with seek | PARTIAL | WatchPage click-to-seek lines | No search box (studio or viewer) | **this PR** |
| 18 | Chapter suggestions + navigation | PRESENT | `editTools.js` `chaptersFromLines`, WatchPage `[data-chapters]` | Gap-based, not topic-based | done |
| 19 | Local script improvement | ABSENT | Only paid `aiWriter.js` | Deterministic templates now; local model later | **this PR (templates)** |
| 20 | Free email/page copy suggestions | PARTIAL | `DEFAULT_EMAIL`, `emailFor` | No free suggester | **this PR (templates)** |
| 21 | Teleprompter assistance | PRESENT | `recorder/teleprompter.js`, `voiceFollow.js` | No pace feedback | done |
| 22 | Smart thumbnail selection | ABSENT | `thumbnail.js` `frameTimes` | No scoring | **this PR** |
| 23 | GIF optimisation | PRESENT | `gifEncode.js`, `gif.worker.js`, `GIF_MAX_BYTES` | none | done |
| 24 | Aspect-ratio export | PARTIAL | `ASPECTS`, `renderSegments` | No 4:5; no "export a copy" | next |
| 25 | Background removal / alpha | PARTIAL | `mediaTools.js` `preparePicture`, `videoMatte.js` | WebM alpha partly checked | next |
| 26 | Profile card themes | PARTIAL | `profileCard.js` single look + accent | No named themes | next |
| 27 | Personalised page previews | PRESENT | `designPreview.js` `attachDesignPreview({page,tokens})` | First contact only | done |
| 28 | Reusable brand overlays | PARTIAL | `editTools.js` overlays, stickers, brand kit | No saved presets | next |
| 29 | Per-contact MP4/WebM | PRESENT | `contactVideo.js` | One contact at a time | done |
| 30 | Personalised QR codes | ABSENT | `qrcode` 1.5.4 installed, unused | PNG/SVG + ZIP | **this PR** |
| 31 | Web Share | ABSENT | none in Outreach | Button in `ShareModal.js` | **this PR** |
| 32 | Clipboard helpers | PRESENT | `ShareModal.js` `copyText`/`copyHtml` | `window.prompt` fallback only | done |
| 33 | Viewer chapters + transcript search | PARTIAL | WatchPage chapters, transcript | Search missing | **this PR** |
| 34 | CTA toolkit / A-B config | PARTIAL | `draft.cta`, WatchPage CTA | No variants/templates | next |
| 35 | Landing personalisation preserved | PRESENT | `landingPage.js`, tests | none | done |
| 36 | Share packs CSV/ZIP | PARTIAL | `email.js` `mailMergeCsv` (with `csvCell` formula guard) | No ZIP | **this PR** |
| 37 | Contact CSV validation | PARTIAL | `draft.js` `parseCsv`, `makeContact`, `mergeContacts` | No email syntax check, silent dedupe | **this PR** |
| 38 | Merge-field QA | PARTIAL | `fillTemplate`, `contactValues` | No `link`, no per-contact QA screen | **this PR** |
| 39 | Campaign metrics | PARTIAL | `analyticsClient.js` milestones, `fetchVideoStats` | UI shows views/plays/clicks only; leads hidden | next |
| 40 | Follow-up prioritisation | PARTIAL | alert trigger, `ProspectTable` filters | No ranking | **this PR** |
| 41 | Owner notifications | PRESENT | `liveAlerts.js`, `outreach-alerts`, `push-dispatch` | Push toggle not in studio | next |
| 42 | Push API + VAPID | PRESENT | `push/pushClient.js`, `_shared/pushAdapter.js`, `public/sw.js` | none | done |
| 43 | Offline drafts / upload recovery | PARTIAL | localStorage `outreach-draft-v1`, `recorder/fileStorage.js` | No IndexedDB draft, no upload retry | next |
| 44 | Multi-tab protection | PRESENT | `tabGuard.js` | none | done |
| 45 | Bulk ops progress/cancel/retry | PARTIAL | `generateCampaign` stages + Stop | No retry-failed, no failure list | next |
| 46 | Privacy / consent | PARTIAL | voice consent, Whisper consent | No viewer-data notice | next |
| 47 | Workers / worklets | PARTIAL | several workers | Silence/thumbnail scoring/CSV on main thread | next |
| 48 | Capability dashboard | PARTIAL | `captionStudio/engines.js` `detectCapabilities` | No single view | **this PR** |
| 49 | Model download approval + clear | PARTIAL | `editor/ml/localAIPanel.js` (timeline only) | Not in Outreach | next |
| 50 | Performance presets | PARTIAL | `QUALITY`, `SILENCE` presets | No device presets | next |
| 51 | Accessibility | PARTIAL | partial ARIA | No live region, no focus trap | next |
| 52 | No duplicated UI | PARTIAL | shared Whisper, one push card | Several overlapping helpers | ongoing |

## 2. Licence and dependency inventory (from `node_modules`)

| Package | Version | Licence | Notes |
|---|---|---|---|
| `@mediapipe/tasks-vision` | 1.2.0 | Apache-2.0 | Models are separate downloads with their own terms |
| `@huggingface/transformers` | 4.3.1 | Apache-2.0 | Each model needs its own licence check |
| `onnxruntime-web` | dev build 1.31.0 | MIT | Transitive |
| `mediabunny` | 1.64.0 | MPL-2.0 | File-level copyleft: keep modified Mediabunny files open |
| `@remotion/web-renderer` | 4.0.540 | Remotion licence (not OSI) | Commercial conditions apply; confirm company licence before expanding use |
| `@remotion/media` | 4.0.540 | no licence field | Treat as Remotion licence until confirmed |
| `gifenc` | 1.0.3 | MIT | |
| `qrcode` | 1.5.4 | MIT | Installed, now used for requirement 30 |
| `jszip` | 3.10.2 | MIT OR GPL-3.0-or-later | Use under MIT; transitive today |
| `fflate` | 0.8.3 | MIT | Transitive |
| `idb` | 7.1.1 | ISC | Transitive |
| `@ffmpeg/ffmpeg` | 0.12.15 | MIT | Core is not bundled; loaded from unpkg or `VITE_FFMPEG_CORE_BASE`. The core build's own licence (LGPL/GPL by codec) must be audited before bundling |
| `web-push` | 3.6.7 | MPL-2.0 | Server only |
| `@ricky0123/vad-web` | not installed | MIT (upstream, unverified here) | Needs install + model licence check |

## 3. Paid or third-party calls in Outreach

Existing, opt-in, unchanged by this work:
- `aiWriter.js` `muapiGenerate` (paid text), used by `writeWithAI` and `translateTexts`.
- `lipsync.js` via `muapi.processLipSync` (paid), guarded by a cost confirm.
- Voice cloning and TTS via `generateAudio` / `voiceForContacts` (paid MuAPI), guarded by consent.
- Own backend: `/api/outreach/site-shot`, `/api/personalization/leads`.
- Third parties: Resend and Slack webhook (alerts), `huggingface.co` model downloads, `unpkg.com` ffmpeg core, Google STUN for live calls.

No requirement in this document adds a paid call. Everything labelled free in the table above runs in the browser or on existing infrastructure.

## 4. The credit-free path today

Record (camera, screen or both) -> silence cuts and trim -> local captions (Whisper in the browser, after an explicit model download) -> personalised text and graphics overlays -> preview -> landing page and per-contact links. Real costs that remain: Supabase storage and Netlify hosting for published videos, and bandwidth for model downloads.

## 5. Blocked items and the exact next action

| Item | Why blocked | Free fallback | Next action |
|---|---|---|---|
| 3 VAD | `@ricky0123/vad-web` not installed; Silero model file absent; licences not yet verified | Existing RMS detector (works today) | Verify licences, add the package and ship `silero_vad.onnx` under `public/models/silero-vad/` |
| 6 Eye-contact notice | No Face Landmarker model file in `public/mediapipe` | None (feature simply off) | Add the Face Landmarker task file after its licence check |
| 7 Gestures | No Gesture Recognizer model file | Buttons and keys | Same as above; keep off by default |
| 9-10 Real-time path | Browser support is partial (Chromium only for document PiP and insertable streams) | Teleprompter PiP, canvas effects | Assess, then add behind feature detection |
| Closed-browser notifications | Needs the existing push backend; cannot be client-only | In-app alerts | Already built (42); expose the toggle inside the studio |

## 6. This PR's scope

Pure, tested logic first, then thin UI: requirements 14 (TXT export), 17 and 33 (transcript search), 19 and 20 (deterministic script and copy suggestions), 22 (smart thumbnail frame ranking), 30 (QR codes), 31 (Web Share), 36 (share-pack ZIP), 37 and 38 (CSV validation and merge-field QA), 40 (follow-up ranking) and 48 (capability dashboard). Everything else is classified above as done, next or blocked.
