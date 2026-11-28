# Video Outreach: free browser enhancements, audit and status

Baseline: `develop` at the time of the audit, plus the Video Outreach redesign (PR 339).
Method: read-only code audit of `src/components/OutreachStudio.js`, `src/components/outreach/*`, `src/lib/outreach/*`, `src/lib/recorder/*`, `src/lib/captionStudio/*`, `src/lib/editor/ml/*`, `src/pages/WatchPage.jsx`, `src/lib/push/*`, `netlify/functions/*push*`, `supabase/functions/outreach-alerts`. Nothing here was measured in a live browser; "present" means the code exists and has tests, not that it was exercised on every browser.

Status key: **PRESENT** (exists, covered by tests or by reading the code), **PARTIAL** (exists, with the gap named), **ABSENT**, and in the last column who does the work: **added in this PR** / **next** / **blocked** (needs a model file, a new dependency licence check, or a backend change).

## 1. The 52 requirements

| # | Requirement | Status | Where it lives today | Gap | Plan |
|---|---|---|---|---|---|
| 1 | Audio quality analyzer | PARTIAL | `recorder/audio.js` (`levelFromSamples`, `clipsInSamples`, `levelHint`, `createLevelMeter`, `recordMicTest`) | No loudness, noise floor or post-take score | **added in this PR** (post-take sound check) |
| 2 | AudioWorklet gate/limiter/normalizer | ABSENT | Only the pitch worklet in `cinegen` | Needs a processor plus pass-through fallback | **added in this PR** (opt-in) |
| 3 | Local VAD | PARTIAL | RMS silence in `editor/ml/audio.js`, `outreach/mediaTools.js`; Silero in `openchatcut/audio/silero-vad.ts` (not wired) | `@ricky0123/vad-web` not installed; `silero_vad.onnx` missing from `public/models/silero-vad/` | blocked: needs package + model licence check |
| 4 | One-click dead-air removal | PRESENT | `OutreachStudio.js` `editActions.removeSilences`, `outreach/editTools.js` `silencesToCuts`, `videoEdit.jsx` | Energy-based detector (see 3) | done |
| 5 | Face-aware auto framing | PARTIAL | `editTools.js` `ASPECTS`, `resolveAspect`; face reframing exists in `openchatcut/reframe/detect.ts` | No 4:5; centre crop only; no face model file in `public/mediapipe` | **partly added** (4:5); face-aware blocked: model file |
| 6 | Eye-contact coaching | ABSENT | none | Needs Face Landmarker model | blocked: model file |
| 7 | Camera gesture controls | ABSENT | none | Needs Gesture Recognizer model; default off | blocked: model file |
| 8 | Record-quality preflight | PARTIAL | `permissions.js`, `devices.js`, `recordMicTest`, `codec.js`, `wakeLock.js` | No single checklist | **added in this PR** |
| 9 | Floating recording monitor (PiP) | PARTIAL | `RecorderModal.jsx` document PiP for the teleprompter | Shows the script, not timer/level/stop | **added in this PR** |
| 10 | Insertable streams / WebCodecs live path | PARTIAL | WebCodecs for export (`captionStudio/burn.js`, `recorder/convert.js`) | Recording stays on MediaRecorder; assess only | assessed: not used (see section 5) |
| 11 | Existing recording modes preserved | PRESENT | `RecorderModal.jsx` `MODES`, `browserCapture.js`, full recorder | none | done |
| 12 | Accessible responsive recorder | PARTIAL | tablist/aria in `RecorderModal.jsx` | No focus trap, many tooltip-only buttons | **added in this PR** (focus trap, live region) |
| 13 | Local Whisper with consent/progress/cancel | PARTIAL | `captionStudio/transcribeClient.js` `ensureModelConsent`; `makeCaptions` progress + Stop | Native `confirm`, no model picker, no clear-model | **partly added** (model picker, clear); native confirm remains |
| 14 | Caption editing + SRT/VTT/TXT | PARTIAL | `renderCaptionsPanel`, `editActions.captionsFile`, `captionStudio` exporters | TXT not wired; no timing/split/merge | **added in this PR** |
| 15 | Burned-in subtitles | PRESENT | `editTools.js` `CAPTIONS`, `videoEdit.jsx` | Only via Apply edits | done |
| 16 | Translated caption tracks | PRESENT | `translateCaptionsTo`, `editor/ml/localAI.js`, WatchPage language select | Consent UX unchecked | done |
| 17 | Transcript search with seek | PARTIAL | WatchPage click-to-seek lines | No search box (studio or viewer) | **added in this PR** |
| 18 | Chapter suggestions + navigation | PRESENT | `editTools.js` `chaptersFromLines`, WatchPage `[data-chapters]` | Gap-based, not topic-based | done |
| 19 | Local script improvement | ABSENT | Only paid `aiWriter.js` | Deterministic templates now; local model later | **added in this PR** |
| 20 | Free email/page copy suggestions | PARTIAL | `DEFAULT_EMAIL`, `emailFor` | No free suggester | **added in this PR** |
| 21 | Teleprompter assistance | PRESENT | `recorder/teleprompter.js`, `voiceFollow.js` | No pace feedback | done |
| 22 | Smart thumbnail selection | ABSENT | `thumbnail.js` `frameTimes` | No scoring | **added in this PR** |
| 23 | GIF optimisation | PRESENT | `gifEncode.js`, `gif.worker.js`, `GIF_MAX_BYTES` | none | done |
| 24 | Aspect-ratio export | PARTIAL | `ASPECTS`, `renderSegments` | No 4:5; no "export a copy" | **partly added** (4:5) |
| 25 | Background removal / alpha | PARTIAL | `mediaTools.js` `preparePicture`, `videoMatte.js` | WebM alpha partly checked | **partly added** (support detection only) |
| 26 | Profile card themes | PARTIAL | `profileCard.js` single look + accent | No named themes | **added in this PR** |
| 27 | Personalised page previews | PRESENT | `designPreview.js` `attachDesignPreview({page,tokens})` | First contact only | done |
| 28 | Reusable brand overlays | PARTIAL | `editTools.js` overlays, stickers, brand kit | No saved presets | **added in this PR** |
| 29 | Per-contact MP4/WebM | PRESENT | `contactVideo.js` | One contact at a time | done |
| 30 | Personalised QR codes | ABSENT | `qrcode` 1.5.4 installed, unused | PNG/SVG + ZIP | **added in this PR** |
| 31 | Web Share | ABSENT | none in Outreach | Button in `ShareModal.js` | **added in this PR** |
| 32 | Clipboard helpers | PRESENT | `ShareModal.js` `copyText`/`copyHtml` | `window.prompt` fallback only | done |
| 33 | Viewer chapters + transcript search | PARTIAL | WatchPage chapters, transcript | Search missing | **added in this PR** |
| 34 | CTA toolkit / A-B config | PARTIAL | `draft.cta`, WatchPage CTA | No variants/templates | **partly added** (second text; per-text totals need a server change) |
| 35 | Landing personalisation preserved | PRESENT | `landingPage.js`, tests | none | done |
| 36 | Share packs CSV/ZIP | PARTIAL | `email.js` `mailMergeCsv` (with `csvCell` formula guard) | No ZIP | **added in this PR** |
| 37 | Contact CSV validation | PARTIAL | `draft.js` `parseCsv`, `makeContact`, `mergeContacts` | No email syntax check, silent dedupe | **added in this PR** |
| 38 | Merge-field QA | PARTIAL | `fillTemplate`, `contactValues` | No `link`, no per-contact QA screen | **added in this PR** |
| 39 | Campaign metrics | PARTIAL | `analyticsClient.js` milestones, `fetchVideoStats` | UI shows views/plays/clicks only; leads hidden | **added in this PR** |
| 40 | Follow-up prioritisation | PARTIAL | alert trigger, `ProspectTable` filters | No ranking | **added in this PR** |
| 41 | Owner notifications | PRESENT | `liveAlerts.js`, `outreach-alerts`, `push-dispatch` | Push toggle not in studio | **added in this PR** |
| 42 | Push API + VAPID | PRESENT | `push/pushClient.js`, `_shared/pushAdapter.js`, `public/sw.js` | none | done |
| 43 | Offline drafts / upload recovery | PARTIAL | localStorage `outreach-draft-v1`, `recorder/fileStorage.js` | No IndexedDB draft, no upload retry | **added in this PR** |
| 44 | Multi-tab protection | PRESENT | `tabGuard.js` | none | done |
| 45 | Bulk ops progress/cancel/retry | PARTIAL | `generateCampaign` stages + Stop | No retry-failed, no failure list | **partly added** (retry list; isolated per-prospect retry not built) |
| 46 | Privacy / consent | PARTIAL | voice consent, Whisper consent | No viewer-data notice | **added in this PR** |
| 47 | Workers / worklets | PARTIAL | several workers | Silence/thumbnail scoring/CSV on main thread | assessed: no worker needed (measured) |
| 48 | Capability dashboard | PARTIAL | `captionStudio/engines.js` `detectCapabilities` | No single view | **added in this PR** |
| 49 | Model download approval + clear | PARTIAL | `editor/ml/localAIPanel.js` (timeline only) | Not in Outreach | **partly added** (list and clear) |
| 50 | Performance presets | PARTIAL | `QUALITY`, `SILENCE` presets | No device presets | **added in this PR** |
| 51 | Accessibility | PARTIAL | partial ARIA | No live region, no focus trap | **added in this PR** (partial) |
| 52 | No duplicated UI | PARTIAL | shared Whisper, one push card | Several overlapping helpers | ongoing |

## 2. Licence and dependency inventory (from `node_modules`)

| Package | Version | Licence | Notes |
|---|---|---|---|
| `@mediapipe/tasks-vision` | 1.2.0 | Apache-2.0 | Models are separate downloads with their own terms |
| `@huggingface/transformers` | 4.3.1 | Apache-2.0 | Each model needs its own licence check |
| `onnxruntime-web` | dev build 1.31.0 | MIT | Transitive |
| `mediabunny` | 1.64.0 | MPL-2.0 | File-level copyleft: keep modified Mediabunny files open |
| `@remotion/web-renderer` | 4.0.540 | Remotion licence (not OSI) | **Accepted by the owner:** the team is under 3 people, which Remotion's free tier covers. Revisit and buy a company licence if the team grows past that |
| `@remotion/media` | 4.0.540 | no licence field | Same Remotion licence and the same owner decision as above |
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
| 10 Real-time path | Insertable streams are Chromium only | MediaRecorder (kept) | Assessed: detected and reported in the Browser check, not used |
| Closed-browser notifications | Needs the existing push backend; cannot be client-only | In-app alerts | Already built (42); expose the toggle inside the studio |

## 6. What this PR added (checked)

| # | Added | Where | Evidence |
|---|---|---|---|
| 14 | Plain-text (.txt) caption export, next to .srt/.vtt | `OutreachStudio.js` `captionsFile('txt')`, panel buttons | Browser: download `Q4-outreach.txt` |
| 17 | Transcript search in the studio (hides non-matching lines, Enter jumps the preview) | `renderCaptionsPanel`, `outreach/transcriptSearch.js` | Browser: "look quick" -> 1 match; unit tests |
| 33 | Transcript search for viewers on the public page | `WatchPage.jsx`, `styles/watch.css` | Browser (stubbed data): 1 match / No matches / Enter seeks; `<b>x</b>` renders as text |
| 19, 20 | Free copy suggestions (headers, messages, buttons, email), script tightening and closing line helpers | `outreach/copySuggest.js`, "Free suggestions" in the editor | Unit tests; browser: applying a suggestion fills the header. **Deterministic wording only: no local language model was added.** |
| 22 | "Suggest best moments" for thumbnails (sharpness, lighting, contrast; no face detection, no conversion claims) | `outreach/thumbnailPick.js`, `ThumbnailDesigner.js` | Unit tests; browser screenshot of three ranked moments |
| 30 | Per-prospect QR codes (SVG and PNG, https links only) | `outreach/qrPack.js`, `ShareModal.js` | Unit tests; browser |
| 31 | Web Share button (only where `navigator.share` exists; link only, never files) | `ShareModal.js` | Unit tests |
| 36 | Share pack ZIP: links.csv (formula-safe), emails.txt, QR per prospect | `outreach/zipStore.js` (no new dependency), `qrPack.js`, Generate step | Browser: real download, `unzip -t` reports no errors |
| 37 | List checks: duplicates, unusual emails (syntax only), website problems, missing details; reversible duplicate removal | `outreach/contactQa.js`, "Check your list" on the Prospects step | Unit tests; browser: remove duplicates, then Undo restores all 4 |
| 38 | Merge-field QA for every prospect before generating | `contactQa.js` `mergeFieldReport`, "Check the personal fields" | Unit tests; browser |
| 40 | Follow-up order with the reason for every point, "Mark followed up" | `outreach/followUp.js`, Generate step | Unit tests; browser (list shows once activity exists) |
| 48 | Browser capability check (19 features), nothing requested | `outreach/capabilities.js`, "Browser check" tool in the editor | Unit tests; browser: 19 rows |

| 43 | Draft backup in IndexedDB (local to this browser, restore offered when the normal copy is empty), upload retry with a status message | `outreach/draftBackup.js`, `outreach/retry.js`, studio Videos page banner | Unit tests; browser: backup written, localStorage cleared, banner shown, restore brings the draft back |
| 45 | "Needs attention" list of prospects whose website capture or lip-sync failed, with "Try the failed ones again" (finished work reused, paid steps still ask for confirmation) | Generate step | Browser with seeded failures. **Partial:** it re-runs the campaign generation (which reuses finished pictures and clips); it does not retry single prospects in isolation |
| 41 | Browser notifications toggle inside the studio (the existing push card and preferences, not a new push setup) | Generate step "Get notified" | Browser: card renders; the real subscribe flow needs a signed-in session and VAPID key and was **not exercised here** |
| 46 | Viewer-facing "What this page records" note that matches the analytics client (Do Not Track, Global Privacy Control, `?consent=`), plus the same facts for the owner | `WatchPage.jsx`, Generate step | Browser: four variants (personal link, plain link, consent off, anonymous) |
| 34 | A second button text on the landing page: each viewer sees one at random (remembered in the browser only in full tracking mode), and the click is recorded with the text that was clicked | `draft.js` `cta.abTest/labelB`, `WatchPage.jsx`, `OutreachStudio.js` | Unit tests; mounted-page tests for random pick, repeat visit and anonymous mode. Not built: per-text totals (the server only counts clicks per prospect) |
| 39 | Campaign results: leads, watched to the end, average watched, how many reached 25/50/75/100% | `outreach/campaignStats.js`, Results page | Unit tests. Uses the per-prospect progress the page already records; says so when the database does not report it |
| 28 | Saved overlay presets (text, name straps, logos, pictures, stickers), kept in this browser only | `outreach/overlayPresets.js`, `EditorTools.js` | Unit tests and tool-panel tests |
| 26 | Profile card looks: Classic, Midnight, Soft, Brand colour (the original look keeps its cache key) | `outreach/profileCard.js`, `OutreachStudio.js` | Unit tests |
| 24 | Portrait 4:5 shape (centre crop, 1080 x 1350) | `outreach/editTools.js` | Unit tests. Face-aware framing is not built (needs a face model file) |
| 50 | Device presets (Light, Balanced, Best): file size and frames examined, with a suggestion from what the browser reports | `outreach/perfPresets.js`, `EditorTools.js` | Unit tests |
| 13, 49 | Speech model picker and a list of what is stored with Remove, inside the studio | `outreach/modelManager.js`, `OutreachStudio.js` | Unit tests with a fake Cache API. The download question is still the shared browser confirm |
| 8 | "Before you record" checklist (no camera or microphone is opened, no prompt) | `outreach/preflight.js`, Browser check panel | Unit tests |
| 1 | Sound check of a recording: voice level, distortion, background noise, a score and plain notes | `outreach/audioQuality.js`, Browser check panel | Unit tests. A guide only; no claim about replies |
| 12, 51 | Keyboard focus stays inside the share window and thumbnail designer and returns to the opener; the studio status line is announced | `outreach/focusTrap.js`, `ShareModal.js`, `ThumbnailDesigner.js`, `OutreachStudio.js` | Unit and mounted tests. The recorder already traps focus in its base dialog; tooltip-only recorder buttons were not audited again |
| 9 | Floating recording controls (time, level, Pause, Stop) in an always-on-top window | `recorder/monitorWindow.js`, `RecorderModal.jsx` | Unit tests with a fake window. Chromium only (Document Picture-in-Picture); not run in a real browser |
| 2 | "Even out my voice": noise gate, slow level normalizer and limiter in an AudioWorklet, off by default, recorded as usual when it cannot run | `recorder/voiceLeveler.js`, `voiceLeveler.worklet.js`, `levelStream.js`, `RecorderModal.jsx` | Unit tests; real Chromium with a fake microphone: the worklet loaded and a peak of 1.03 came out at 0.88 (ceiling 0.89). Not tried in Safari or Firefox |

Assessed, nothing built (10, 25, 47): the live capture path stays on MediaRecorder (insertable streams are detected and reported, not used); transparent WebM is detected but its playback was not verified; a worker for the sound check is not needed (a 30 minute recording is measured in about 0.1 s on the main thread).

Not done (still **next** or **blocked** above): voice-activity detection (3), eye contact (6), gestures (7), face-aware framing (5), a download dialog of our own instead of the browser confirm (13, 49), per-text button totals (34), isolated per-prospect retry (45), and a full accessibility audit of the recorder (12, 51).
