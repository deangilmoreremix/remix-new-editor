# Social publish modal — audit, feature matrix and manual QA

Scope: the existing `SocialPublishModal` (`src/features/personalization/components/SocialPublishModal.tsx`).
It was enhanced in place: the 4-step flow (Write → Thumbnail → Destinations → Review & Publish), the MuAPI
orchestrator, account connection, payload builders and retry logic are untouched.

## Audit findings that shaped the work

* The "Social Media Scheduling modal" is the React `SocialPublishModal`. The older `src/components/modals/SocialPublisherModal.jsx`
  is a legacy stub (fake 1.5 s timeout, no MuAPI) and was left alone.
* **MuAPI publishing is immediate.** `socialPayloads.ts` documents that no schedule field is sent ("Nothing undocumented
  (schedule, …) is ever sent"), and there is **no existing server-side scheduled-publishing job, queue table or cron** for
  social posts (`SmartVideoScheduler.js` is placeholder UI; the only schedule-related migration is unrelated cleanup).
  Therefore calendar/queue entries are **local reminder plans**; nothing publishes at the planned time. A true scheduler needs a
  Netlify scheduled function + Supabase table that holds the MuAPI key server-side — not built (see "Not done").
* A service worker (`public/sw.js`) and Web Push client (`src/lib/push`) already exist and were reused, not duplicated.
* Dependencies already present and used: `mediabunny` (MIT-style, WebCodecs mux/encode), `idb-keyval` (Apache-2.0).
  **No new dependencies were added.**

## Feature matrix

| # | Feature | Status | Where |
|---|---|---|---|
| 1 | Video resizing 9:16/1:1/16:9/4:5, fit/fill/reposition | Implemented (needs WebCodecs; MP4/H.264 else WebM) | `mediaPrep.computeReframe`, `mediaProcessing.processVideo`, Media tab |
| 2 | Trimming (start/end, scrub, presets, non-destructive) | Implemented; no frame-strip timeline | Media tab |
| 3 | Custom thumbnails | **Existing** designer reused (Thumbnail step); added "use video frame as thumbnail" | `probeVideo`, Media tab |
| 4 | Animated text | Not implemented here (existing caption/animation studios not wired) | — |
| 5 | Audio enhancement | Not implemented | — |
| 6 | Caption editing | Partial: SRT/VTT import, cue edit, shift, position, export. No burned-in export | `subtitles.ts`, Media tab |
| 7 | Local AI transcription | Not implemented (`@huggingface/transformers` + recorder `whisper.ts` exist for later reuse) | — |
| 8 | Background removal | Not implemented (`template-generator/cutout.js` exists for later reuse) | — |
| 9 | Hashtag suggestions | Implemented, deterministic local (no live trends); saved groups | `hashtags.ts`, Optimize tab |
| 10 | Caption rewriting | Implemented via Prompt API where available; accept/discard; short-form local fallback | `copyTools.ts` |
| 11 | Translation | Implemented via Translator API; explicit unavailable state | `copyTools.ts` |
| 12 | Summarization | Implemented via Summarizer API (text only) + local fallback | `copyTools.ts` |
| 13 | Platform previews | Implemented (HTML/CSS), safe areas, mobile/desktop, aspect warnings, central config | `platformConfig.ts`, `PlatformPreviews.tsx` |
| 14 | Drag-and-drop media | Implemented: multi-file drop, type validation, reorder. No network upload progress (MuAPI upload happens at publish and is not progress-instrumented) | Media tab |
| 15 | Clipboard | Implemented: paste images, copy text/hashtags; denial/unsupported handled. Copy shareable link: not added | `clipboard.ts` |
| 16 | Bulk processing | Partial: concurrency-limited, cancellable, memory-budgeted queue with failure reporting (`jobQueue.ts`, tested). **No dedicated Web Worker** (mediabunny/WebCodecs encode off the main thread internally); queue not yet exposed as a multi-post UI | — |
| 17 | Draft autosave | Implemented (IndexedDB, memory fallback, quota errors, beforeunload guard) | `draftStore.ts` |
| 18 | Offline drafts | Partial: drafts edit/save offline, connection indicator. Offline app-shell load depends on the existing `sw.js`, which only caches academy assets | Plan tab |
| 19 | Notifications | Partial: Notifications API after a click, on real publish results + in-app due reminders. **Push when the app is closed is not wired** (needs server delivery) | `notifications.ts` |
| 20 | Compression | Implemented: presets, estimate, before/after size | Media tab |
| 21 | Calendar | Implemented: day/week/month, Intl timezones, drag-to-reschedule, filters, conflicts. **Local plans only** | `calendar.ts`, Plan tab |
| 22 | Duplication | Implemented: duplicate, to platform, campaign clone; fresh ids; publish state never copied | `draftStore.duplicateDraft` |
| 23 | Asset exports | Implemented for prepared media, thumbnails, SRT/VTT, caption copy; clear filenames | `exportNames.ts` |
| 24 | Accessibility/quality checks | Implemented, errors only where MuAPI/platform would reject | `validation.ts` |

## Browser limits
* WebCodecs (video edit): Chromium, Safari 16.4+, Firefox desktop recent; otherwise video tools show an unavailable message and the original publishes.
* Prompt/Translator/Summarizer APIs: Chromium-only/experimental; may need a one-time on-device model download (user must confirm). Absent in Firefox/Safari.
* Clipboard read needs HTTPS + permission; Safari restricts it. Notifications need a user gesture; iOS requires an installed PWA.
* IndexedDB can be blocked (private modes); the studio falls back to memory and says so.

## Manual QA (cannot be covered by unit tests)
1. Open the modal from any studio's "Post to social". Confirm the 4 steps, MuAPI key prompt, account connect and Publish behave as before.
2. Right column tabs: Preview (original card), Platforms, Optimize, Media, Plan. Resize to ~375 px and confirm the panel stacks under the editor with no horizontal scroll.
3. Platforms: select 2+ destinations; toggle safe-area/mobile/crop; load a 16:9 video and confirm TikTok shows an aspect warning.
4. Media: drop a PDF (rejected message) and a PNG + MP4 (listed, reorderable). Reframe a video to 9:16 fill and fit; confirm playable output, "Use as post media", then publish to a test account via MuAPI.
5. Trim: scrub, set 0–5 s, Trim; output duration ≈ 5 s. Cancel mid-encode; confirm no output and the UI recovers.
6. Optimize: in Chrome with built-in AI, run Rewrite/Summarize/Translate (model download needs your confirmation); in Firefox/Safari confirm "not available" states. Original text only changes after **Replace caption**.
7. Plan: write a caption, wait ~1 s → "Saved". Reload the page, reopen the modal → draft listed; **Open** restores copy/destinations/thumbnail. Go offline (DevTools) → indicator changes, edits still save.
8. Calendar: set a future time, drag the card to another day, switch time zones, confirm the displayed day/time shift correctly; overlapping posts on one platform turn red.
9. Duplicate a draft that was already published → copy is a draft with no request ids.
10. Notifications: click Enable, publish a post → success notification; deny permission → explanatory text, no errors.
