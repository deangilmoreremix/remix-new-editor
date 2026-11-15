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
Pick a look (Capite's 27, grouped by category, plus the editor's own) and the words light up as they are spoken. "Make word-timed captions" listens to the voiceover (or, with none, to each clip's own sound) on the device: free, no key, nothing uploaded.
- **Whisper WebGPU** (default): Whisper through Transformers.js, the engine behind `@remotion/whisper-webgpu`. Uses the GPU when the browser has WebGPU, otherwise WASM. Measured in a CPU-only headless browser: a 5 s clip with the tiny model takes about 8 s after the model download.
- **Whisper.cpp (WASM)**: `@remotion/whisper-web`, the browser build of Whisper.cpp. (`@remotion/install-whisper-cpp` installs a native binary on a server and cannot run in a browser or on Netlify.) It needs a cross-origin-isolated page (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless`). This site is not isolated today, so choosing it shows "Whisper.cpp needs a cross-origin-isolated page" and the work runs on Whisper WebGPU instead. To turn it on, serve the page with those two headers (this can break third-party embeds and sign-in popups, so test the whole app first).
- **Not verified in a real browser:** with the page isolated, the Whisper.cpp run did not finish in the sandbox (the model downloaded fine; the WASM run hung and was stopped after about 20 minutes). Its code path is covered by tests with the package mocked only. Check it on a machine with the two headers on before relying on it; Cancel stops a listen that hangs.
- With no audio to listen to, the words follow the written script over the cut. Listening is capped at the first 3 minutes.
- On the timeline the captions are the editor's own (the first clip's Captions section), so they can be edited there. `.srt` can be downloaded from the panel.
- Capite's looks are ported from <https://github.com/muneebkhan08/Capite> (MIT, © 2026 Capite Contributors): fonts, colours, outline, glow and highlight style, drawn with the editor's caption renderer. Capite's server and its ASS/VTT/MP4 export are not used.
- User check: WebGPU speed on a machine with a GPU, and a real spoken clip in another language.

## 7. Other notes
- `public/motion-studio/legacy-textures/agent-stream.jpg` is a generated placeholder (the original artwork was never committed in this repo or in `develop`). Replace it with the real image when you have it.
- Merging the pull request is done in GitHub.
