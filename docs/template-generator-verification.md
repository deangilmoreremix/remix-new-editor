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
| **Whisper.cpp (WASM)** | `@remotion/whisper-web` | the tab | a cross-origin-isolated page (`Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless`). This site is not isolated, so choosing it shows why and uses Whisper WebGPU. |
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

Captions land on the timeline as the editor's own captions (first clip's Captions section), editable there; `.srt` can be downloaded from the panel. With no audio to listen to, the words follow the written script over the cut; listening covers the first 3 minutes.
Capite's looks are ported from <https://github.com/muneebkhan08/Capite> (MIT, © 2026 Capite Contributors): fonts, colours, outline, glow and highlight style, drawn with the editor's caption renderer. Capite's server and its ASS/VTT/MP4 export are not used.

## 8. Add to Video Pages (Preview step → "🏠 Add to Video Pages")
Next to "Export video" on the Preview step. It renders the video in the browser if it has not been rendered yet (the file also goes to your downloads, as with Export), then opens a window built like the editor's "Add to timeline": pills with counts for the Video Pages design groups (Editable landing pages 34, Page structures, Layouts, Personal intro, Pitch page; 65 designs, the same set as the studio's New page picker, which no longer offers the older fixed-layout website designs), a "Choose a design" card with search, look and page-title fields, and a grid of cards. **Every card is a real picture of the design**, drawn with its own images, fonts, sample content and its own video poster (the placeholder picture a design shows until a video frame exists). The 32 designs that have no poster of their own (the plain layouts, pitch pages and a few others) show a sample frame instead; the generator lists them. Pick a design and press "Create draft page": the video is uploaded to storage, a poster is made, and a **draft** page is created with that design (same code as the studio's "Create page", `src/lib/landingPages/ingest.js`). Then **"Open in Editor"** opens the studio in a new tab straight in that page's editor (the editor with the design loaded); "Open in Video Pages" opens the studio's list. Only available in the Timeline Studio Editor (it needs the browser export).

Design pictures: `public/landing-previews/<design id>.jpg`, made by `node scripts/generate-landing-design-previews.mjs` (add `--force` to redo all, `--only=id,id` for some; it renders each design in headless Chrome, waits for every image and font to load and refuses a page with a broken image or one flat tone). Run it again when a design changes or a new one is added; a test fails if a design has no picture. The studio's New page screen shows the same pictures (a card whose picture cannot load shows the page's shape instead).

Verified: all 65 pictures (viewed on a contact sheet), the window in a real browser at the editor's theme (all previews loaded, selecting, the created state, "Open in Editor" handing over the page id), and the hand-off into the studio's editor with tests (Puck and the upload faked there).
**Not verified (needs a real sign-in and the shared project, so I did not create test pages there):** the actual upload and draft row for a real rendered video, and the studio opening that draft in its editor in a second tab. Check: render, press the button, pick a design, create, press "Open in Editor", confirm the editor opens on the design with your video. Limits: 100 MB per video; you must be signed in. The tab handoff expires after two minutes.

## 9. Other notes
- `public/motion-studio/legacy-textures/agent-stream.jpg` is a generated placeholder (the original artwork was never committed in this repo or in `develop`). Replace it with the real image when you have it.
- Merging the pull request is done in GitHub.
