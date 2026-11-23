# Template Generator: checks that need your accounts, keys or hardware

Everything that can be tested without them is covered by automated tests. These checks need a real sign-in, real keys or a GPU.
Deploys run on Netlify (lint, then build, for every deploy preview); there is no other CI.

## 1. Deploy preview (2 minutes)
1. Open the latest Netlify deploy preview for the branch and sign in.
2. Timeline editor → the Template Generator. Create a template: pick a Video template clip and a Pexels clip, pick a script, pick a transition and a lower-third style, open Preview.
3. Check: styled text on the video; Save as template; Export video (a short MP4 downloads and plays).
4. Netlify environment variables that must be set: `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `SUPABASE_JWT_SECRET`. The customer's own OpenAI key goes in Settings → API keys (there is no platform OpenAI key).

## 2. Real keys, one command
```bash
PEXELS_API_KEY=... PIXABAY_API_KEY=... OPENAI_API_KEY=... node scripts/verify-template-generator-keys.mjs
```
Runs the app's own server handlers against the real services. Prints PASS / FAIL / SKIP per check and saves `verify-out/voiceover-check.mp3`
(play it). Keys are read from the environment and never printed. Exit code 1 if a check that ran failed.

## 3. Two devices (2 minutes, needs a real sign-in)
1. Browser A: sign in, create a template, Save as template. The start screen badge should say it is synced.
2. Browser B (another browser or device, same account): open My templates. The template should appear within a few seconds.
3. In B rename it or change its script and save. In A, reopen My templates: the change appears.
4. Delete it in A. In B it disappears (no ghost copy comes back).
The sync rules (newest edit wins, deletes win, older writes ignored by the database) are also covered by automated tests against simulated users.

## 4. Cut-out (needs a person in a real clip; a GPU makes it fast)
Preview step → "✂ Cut out" on a clip with a person.
- Engine: BG0 (BiRefNet) where the browser can run it, otherwise the older MODNet. First use downloads a model (about 190 MB for BG0).
- Measured in a CPU-only headless browser: a photo takes about 10 s per picture; an 8 s video clip takes about 2 minutes (masks on sampled frames, budget about 90 s). On the clip tested, BG0 cut out the people cleanly in all four scenes where MODNet kept only fragments.
- Not measured: WebGPU. Expect it to be much faster; if it is not, tell us the clip length and the time.
- A result that keeps under 6% of the picture is refused and the clip is left as it is ("Original" restores any cut-out).

## 5. Rights note in the video library (the library owner, in the shared Supabase project)
The published `catalog.json` in the `demo-template-videos` bucket still has the old `rights` text. Suggested replacement for that one field:

> Third-party media. The owner has confirmed commercial-use permission for these clips; the author and post link for each clip are in its credit field.

1. Download the current `catalog.json` and keep a copy (backup).
2. Change only the `rights` value; leave every clip, category and URL as it is.
3. Re-upload `catalog.json` (and `README.txt` if it repeats the note) to the same path with `node scripts/upload-template-videos.mjs` (needs `SUPABASE_SERVICE_ROLE_KEY`; it only writes to that bucket). Other apps only read from this bucket; do not rename or delete it.
Nothing in the Template Generator depends on this wording.

## 6. Styled captions (Preview step → "💬 Styled captions")
Pick a look (Capite's 27, grouped by category, plus the editor's own) and the words light up as they are spoken. "Make word-timed captions" listens to the voiceover (or, with none, to each clip's own sound). "Make the captions automatically when the voiceover is made" does it for you. Free, no key; the browser engines upload nothing.

| Engine | Package | Where it runs | Needs |
|---|---|---|---|
| **Whisper WebGPU** (default) | `@remotion/whisper-webgpu`, in a worker | your GPU, in the tab | WebGPU. Without it the editor's built-in Whisper (same Transformers.js underneath, CPU path) listens instead and the panel says so. Model from `remotion.media`, cached, then works offline. Sizes: base, tiny, small, large-v3-turbo. |
| **Whisper.cpp (WASM, experimental)** | `@remotion/whisper-web` | the tab | a cross-origin-isolated page (`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless`). This site is not isolated, so choosing it shows why and uses Whisper WebGPU. |
| **Whisper.cpp (local server)** | `@remotion/install-whisper-cpp` | a small server on your computer | `node scripts/captions-server.mjs`, Node, git, a C compiler (`make`) and `ffmpeg`. Listed in the panel only while the server answers on `127.0.0.1:8787`. A native program cannot run in a tab or on Netlify. |

The native engine also works from the command line: `node scripts/transcribe-whisper-cpp.mjs clip.mp4 --model=base --language=auto --out=captions.json` (first run installs Whisper.cpp and the model into `./.whisper`, git-ignored). The server only answers pages on localhost, `smartvid.app` and this site's Netlify previews, one listen at a time.

**Verified (real runs, 5 s spoken clip made with the free on-device voice):**
- Whisper WebGPU package, in a browser with a (software) WebGPU adapter: 12 timed words, "Harbor Dental" kept as two words. The software adapter took about 2 minutes; a real GPU is far faster (not measured).
- Same request in a browser without WebGPU: falls back by itself to the built-in Whisper, with the note; 11 timed words in about 17 s.
- Native Whisper.cpp 1.5.5 through `@remotion/install-whisper-cpp` (installed, built and run on Linux, `tiny` model): 12 whole words with timings, from the command line and through the local server (health, CORS preflight, blocked origin, a real POST).

**Not verified:**
- Whisper.cpp WASM (`@remotion/whisper-web`) in a real browser: the run did not finish in the sandbox. Its code is tested with the package mocked only.
- Real-GPU speed of Whisper WebGPU, and a spoken clip in another language.
- The browser calling the local server from the deployed https page (Chrome allows https → `127.0.0.1`; headers for Private Network Access are sent, but this was only checked with curl).
- With the page isolated (headers above), a model download and a listen through the WASM build.

Captions land on the timeline as the editor's own captions (first clip's Captions section), editable there; `.srt` and `.vtt` can be downloaded from the panel (and from the clip's Captions section in the editor). With no audio to listen to, the words follow the written script over the cut; listening covers the first 3 minutes.
Capite's looks are ported from <https://github.com/muneebkhan08/Capite> (MIT, © 2026 Capite Contributors): fonts, colours, outline, glow and highlight style, drawn with the editor's caption renderer. Capite's server and its ASS/VTT/MP4 export are not used.

## 8. Add to Video Pages (Preview step → "🏠 Add to Video Pages")
Next to "Export video" on the Preview step. It renders the video in the browser if it has not been rendered yet (the file also goes to your downloads, as with Export), then opens **the app's one landing page picker** (`openLandingPagePicker`, `src/lib/landingPages/pickerModal.js`, the same one the Library, the Personalization hub and the editor's "Add to timeline" → Landing pages tab use) with the rendered video attached. In the picker: choose a design (search and category chips, live previews), it opens as the full page with your video in the visual editor, and **"Save as my page"** uploads the video (a local file is copied to storage) and creates the draft landing page. The generator then says "Saved as a draft landing page" (or shows the link if it was published). The picker opens above the generator window (it takes a `zIndex`; the generator is at 9999). Only available in the Timeline Studio Editor (it needs the browser export). Limits: 100 MB per video; you must be signed in.

Design pictures: the studio's New page screen draws the editable designs live and shows a real picture for the other designs (plain layouts, intro and pitch pages): `public/landing-previews/<design id>.jpg`, made by `node scripts/generate-landing-design-previews.mjs` (`--force` redoes all, `--only=id,id` some; it renders each design in headless Chrome, waits for every image, font and video poster to load, and refuses a page with a broken image or one flat tone). Run it again when such a design changes or is added; a test fails if one has no picture.

Verified: the picker opening with the generator's video, above the generator window, and reporting the saved page (tests with the picker faked), and the picker's own tests.
**Not verified (needs a real sign-in and the shared project, so I did not create test pages there):** a real render → "Save as my page" in the live app (the upload and the draft row), and the saved page showing in Video Pages. Check: render, press the button, pick a design, edit if you like, "Save as my page", then open Video Pages and confirm the draft with your video.

## 9. Live captions while recording (the new editor's voice-over recorder)
While the microphone voice-over recorder runs (the record button in the Edit tab's tool sidebar), a strip shows what is being said, using the browser's Web Speech API (`src/lib/editor/speech/liveCaptions.js`, the strip is `src/cinegen/components/edit/live-caption-strip.tsx`).
- **On this device by default** (`processLocally`): needs a browser with the on-device check (Chrome 139+) and the language pack. If the pack is not downloaded the strip offers "Download it"; nothing listens until it is there.
- **The browser's online service only on a click** ("Use the browser's online service"): in Chrome it sends the audio to the browser's provider, and the strip says so. The choice is remembered in this browser (`remix.liveCaptions.browserService`).
- It is a **live preview with no word timing**. Timed, styled captions come afterwards from the clip's "Generate captions" (Whisper) in the Captions section.
- Firefox has no speech recognition; the strip says so.

Verified: the engine and the strip with a stand-in recognizer (tests), and the real Chrome 153 API surface in headless Chrome: the recognizer exists and `available({ langs: ['en-US'], processLocally: true })` answers `downloadable`.
**Not verified (needs a real microphone and the language pack):** a real recording with live text on this device and via the online service; the pack download (it comes from the browser vendor), other languages, and Safari/Edge behaviour. The language is English (US) for now.

### MoonshineJS (live captions): checked, not integrated
Checked from npm and Hugging Face: `@moonshine-ai/moonshine-js` 0.1.29 is **MIT**, and so is the English model it uses (the `onnx-community/moonshine-*-ONNX` model cards say MIT). Its **Spanish model is under the "Moonshine AI Community License"** (free for researchers, developers, small businesses and creators under $1M annual revenue), which is not a blanket production licence for this app. The package was last published in **July 2025**, the original JS repository is reported as archived in favour of a newer SDK (I could not read the repository from this session to confirm), and the models are **English only**. Web Speech (above) already gives a live preview in many languages with no extra download, and Whisper does the timed captions. So it is **not added**. If a free, fully on-device live engine for English becomes a requirement, the MIT English model is the candidate; re-verify the current SDK and licence first.

## 9b. Free AI Captions window (Caption Studio, "💬 Add AI Captions" in the studios)

The shared Caption Studio (`src/lib/captionStudio`, also copied into OpenHiggsBolt) with two additions made here: **Your videos** (the Generate tab lists every video made in the app: the studios' generation history on this device plus the cloud copy when signed in, videos finished in this tab such as a timeline or Template Generator export, and the clip the studio passed in; one click captions it, no upload) and **History** (caption jobs kept in this browser: duration, language, style, processing time, size, date; open and edit again, SRT, delete). The 32 looks are also drawn on a real picture of the picked video (the host's sample photo until one is picked).

Checked here in a real browser (headless Chrome, no GPU): the list, picking, a video saved while the window was open appearing, no upload request, the looks on the video's real frame, the History tab. The earlier AI Captions window's transcription and MP4 burn-in were verified in a real browser before it was replaced; Caption Studio's own engines are covered by its tests.

Needs you (accounts, keys, hardware):
1. Signed in, open the window from a studio: your created videos are listed (the cloud copy of the history needs a real sign-in) and the one you came from is picked; Generate captions runs with no upload.
2. Whisper speed on a real GPU.
3. A video from another website: the browser may not let the page read it, so the captions work but the rendered video and the look pictures may not.
4. After editing `src/lib/captionStudio`, copy it to OpenHiggsBolt: `node scripts/sync-caption-studio.mjs ../OpenHiggsBolt` (the sibling repo is not in this checkout). The two new files (`videos.js`, `history.js`) import nothing; the host passes `videoLibrary`, `watchVideos` and `sampleImage` (see `src/lib/editor/captionActions.js`).
Videos finished during a visit appear in "Your videos" only until the page is closed.

## 10. Other notes
- `public/motion-studio/legacy-textures/agent-stream.jpg` is a generated placeholder (the original artwork was never committed in this repo or in `develop`). Replace it with the real image when you have it.
- Merging the pull request is done in GitHub.
