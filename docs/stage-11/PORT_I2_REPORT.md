# Port I2: local in-browser narration (TTS) and music generation

Scope: FreeCut's local text-to-speech and music generation, ported into CineGen's **Media tools > Audio** tab as a section named **Local AI audio**. Weights are never bundled; they are fetched from huggingface.co on demand, after explicit consent, and kept in the browser's Cache Storage.

## What was built

| File | Role |
|---|---|
| `src/cinegen/lib/local-ai/models-audio.ts` | Standalone model registry (`id, name, purpose, sizeMB, licence, sourceUrl, loader`, plus `enabledByDefault`). Same shape as portI1's manager so it can be merged into it. |
| `src/cinegen/lib/local-ai/audio-manager.ts` | Pure logic, dependencies injected: consent (persisted), blocking rules, capability check, storage quota check, install with progress, cancel, delete, serial generation queue with cancellable jobs, WebGPU to WASM retry. |
| `src/cinegen/lib/local-ai/audio-runtime.ts` | Browser side: real WebGPU adapter probe, Cache Storage inspection/deletion, `navigator.storage.estimate`, kokoro-js and MusicGen pipelines (lazy imports), abortable Hugging Face downloads. |
| `src/cinegen/lib/local-ai/wav.ts`, `place-audio.ts` | 16-bit mono WAV encoder, sentence chunking, silence guard; generated audio goes through the adapter's `media.importBlob` (so the Fix B IndexedDB blob store keeps it), becomes an `audio` asset, and a clip at the playhead on the first unlocked audio track (a new one if none). Provenance (model, licence, prompt, voice) is stored in `asset.metadata`. |
| `src/cinegen/components/edit/stage4/local-audio-panel.tsx` | Minimal stand-alone UI: model card with licence + "how checked" + size, consent checkbox(es), Download / Cancel / Delete, progress bar, text or prompt input, Generate. Hooked into `audio-panel.tsx` / `stage4-dock.tsx` (the dock's dispatch type gained `ADD_ASSET`). |
| `src/cinegen/__tests__/localai/audio-manager.test.ts` | 21 unit tests (mocked pipelines). |
| `docs/stage-11/smoke/local-ai-audio-smoke.cjs` | Real headless-Chromium end-to-end run (see evidence). |

Generated audio is an ordinary WAV file in the media pool, so preview, waveform jobs, persistence and the export treat it like any imported audio.

## Models and licences

Licences were read from the upstream cards over the proxy on 2026-11-15 (HF YAML front matter and `api/models` tags), not guessed.

| id | What | Size | Licence | Verified? How | Enabled by default |
|---|---|---|---|---|---|
| `kokoro-82m-q8` | Kokoro 82M TTS, 8-bit (`onnx/model_quantized.onnx`) | 93 MB | Apache-2.0 | Yes: `license: apache-2.0` on `onnx-community/Kokoro-82M-v1.0-ONNX` and base `hexgrad/Kokoro-82M` (card: "Apache-licensed weights ... deployed in commercial APIs"). File size from the HF tree API (92,361,116 B). | Yes (still needs consent) |
| `kokoro-82m-fp32` | Same, full precision (`onnx/model.onnx`) | 326 MB | Apache-2.0 | Same as above (325,532,232 B). | Yes (still needs consent) |
| `musicgen-small` | MusicGen Small, Xenova ONNX (FreeCut's music model) | 742 MB | **CC-BY-NC-4.0** (non-commercial) | Yes: `license: cc-by-nc-4.0` on `Xenova/musicgen-small` and `facebook/musicgen-small`. | **No.** Blocked until the user ticks "non-commercial use only"; the UI shows the licence and the reason. |

Rules enforced in code (and tested): an unverified licence is never installable; a non-commercial model needs the explicit acknowledgement before consent can even be recorded; nothing is requested from huggingface.co before consent.

Looked at and not shipped:

* Permissive music alternative: none found that runs in the browser. `facebook/musicgen-*`, `Xenova/musicgen-small`: CC-BY-NC-4.0. `cvssp/audioldm*`: CC-BY-NC-SA-4.0. `stabilityai/stable-audio-*`: Stability community licence (`other`), no transformers.js build. So **music is off by default and non-commercial only**; there is no commercial-safe local music option in this port.
* Supertonic TTS (`onnx-community/Supertonic-TTS-ONNX`): `openrail` (use restrictions); FreeCut ships a loader but it is not ported.
* MOSS-TTS-Nano (`OpenMOSS-Team/MOSS-TTS-Nano-100M-ONNX`): `apache-2.0` on the HF card, but FreeCut runs it through a vendored custom worker (`public/moss-tts/*`, with a bundled ORT host); not ported. The vendored ORT files are onnxruntime-web (MIT per its repo LICENSE).
* SpeechT5 / MMS-TTS: `microsoft/speecht5_tts` is MIT but the `Xenova/*` ONNX repos declare no licence; `facebook/mms-tts-eng` is CC-BY-NC-4.0. Not offered.

Dependency caveat for the owner: `kokoro-js` and `phonemizer` declare Apache-2.0, but `phonemizer` embeds eSpeak NG compiled to WASM, and eSpeak NG is GPL-3.0. Whether that is acceptable for distribution was not resolved here (the existing `package.json` already depends on kokoro-js).

Also: `kokoro-js` bundles its own `@huggingface/transformers` 3.8.1 (the app depends on 4.3.1); MusicGen uses the app's copy. Both are lazily imported and only fetched when the feature is used.

## Evidence: real vs mocked

### Real (run in this sandbox)

`docs/stage-11/smoke/local-ai-audio-smoke.cjs` drives the real CineGen page (`#/timeline`, EDIT tab, Media tools > Audio > Local AI audio) in headless Chromium 153 with the real Kokoro 82M q8 weights (`onnx/model_quantized.onnx`, 92,361,116 bytes, downloaded with curl from huggingface.co) and the real kokoro-js + onnxruntime-web code. Result: **ALL PASS (18 checks, 0 failures)**, log in `docs/stage-11/evidence/local-ai-audio-smoke.log`.

* Gating: Download disabled until the consent box is ticked; no request to huggingface.co before consent; licence (apache-2.0) and size shown; MusicGen shows CC-BY-NC-4.0 and its Download stays disabled without the non-commercial acknowledgement.
* Install: weights land in Cache Storage (`transformers-cache`), card reports installed (download+load 8 to 28 s from local files, WASM backend).
* Generation: "Welcome to CineGen. This narration was generated entirely inside your browser." produced a 6.12 s clip. A WAV copied out of the page (`docs/stage-11/evidence/narration.wav`): pcm_s16le, 24 kHz, mono, 6.12 s, **mean -23.6 dB, max -4.8 dB** (ffmpeg volumedetect), i.e. not silent.
* Timeline/asset model: the saved project has an `audio` asset (blob URL, `metadata` records source, model `kokoro-82m-q8`, licence `apache-2.0`) and a clip of 6.12 s at 0.0 s on an audio track.
* Export: the Export tab rendered an H.264/AAC mp4 (`docs/stage-11/evidence/export-local-ai.mp4`, video 6.13 s + audio 6.14 s). The timeline's only video is a silent 8 s testsrc clip (`-an`), so the audio in the export is the narration: **mean -23.7 dB, max -4.7 dB** (volumedetect on the exported file).
* Persistence (Fix B): after a page reload the generated asset id is present in the IndexedDB blob store `cinegen-local-media`; the card still lists the model as downloaded.
* Cancel: with the fp32 model's weights request stalled, the UI shows progress and Cancel, and Cancel returns the card to "not downloaded".
* Delete: "Delete downloaded files" removes the weights from Cache Storage (0 `model_quantized` entries left).

How the sandbox differs from a user's browser (stated plainly):

* Headless Chromium has `navigator.gpu` but no GPU adapter, so the run used the **WASM (CPU) fallback**. WebGPU was not exercised. This found and fixed a real bug (the capability check only tested `'gpu' in navigator`; it now requests an adapter, and a failed WebGPU load retries on WASM).
* Chromium here does not trust the sandbox proxy CA, so Playwright redirected the huggingface.co requests to a local static server serving the same real files (`docs/stage-11/smoke/static-cors.cjs`), with `bypassCSP` for that localhost redirect. The page's own download, progress and Cache Storage code ran against those responses; the actual huggingface.co transfer from inside the browser was **not** exercised (the files were fetched with curl through the proxy, and licences/sizes were read from huggingface.co).
* The run used a patched Vite wrapper only because the worktree's `node_modules` is a symlink into the main checkout (`server.fs.strict=false`); the repo's `vite.config.js` is unchanged.
* One cancel side effect: cancelling a Kokoro download makes the library log an unhandled promise rejection ("Could not locate file ... model.onnx") to the console. It is harmless but noisy and not suppressed.
* The 742 MB MusicGen model and the 326 MB fp32 Kokoro model were **not downloaded or run**. **Music generation is therefore untested end to end** (only its gating and its code path via types/lint). It is a direct port of FreeCut's `musicgen-service.ts` call sequence (tokenizer, `MusicgenForConditionalGeneration.generate`, streamer-based cancel), nothing more can be claimed.

### Mocked (unit tests, `src/cinegen/__tests__/localai/audio-manager.test.ts`, 21 tests)

Registry shape and gating (MusicGen disabled by default, unverified never installable, non-commercial needs acknowledgement), consent persistence/revocation, consent required before any load, WebGPU vs WASM selection and retry on WASM, "no backend" refusal, quota refusal before download (and cached models skip it), progress, cancel (partial cache removed, state back to absent), failure then retry, delete (dispose + cache removal), idempotent install, serial queue order, cancelling a queued job and a running job, wrong-purpose requests, WAV encoder header/duration, sentence chunking, placement through `importBlob` as an audio asset and clip, and the silence guard.

### Suites

`npx vitest run src/cinegen src/openchatcut`: **228 files passed, 3 skipped; 1779 tests passed, 33 skipped, 0 failed** (includes the parity test and `help-coverage`), run after the last code change. `help-coverage` needed five help entries for the new controls (added in `help-content.ts`). eslint on the changed files: 0 errors.

## Limits and unfinished

* Music: MusicGen only, CC-BY-NC, off by default; not run here. No permissive local music model exists in the transformers.js ecosystem today (see above).
* Not merged into portI1's Local AI manager: only the registry module is shaped for it; the manager/consent/progress UI here is stand-alone, as requested. Cache deletion for Kokoro removes the weights file only; the few-KB tokenizer/config files and downloaded `voices/*.bin` (about 0.5 MB each, separate `kokoro-voices` cache) stay.
* Only English Kokoro voices (12 of its 28 listed in the UI).
* WebGPU path unverified in this sandbox (no adapter). Preview in WebGPU browsers should be faster; WASM run was real.
* Quota check uses `navigator.storage.estimate()` (needs headroom of 1.25 x model size); browsers that cannot estimate skip it.
* TTS text longer than a few paragraphs generates sentence by sentence in one clip; there is no per-sentence timeline split.
* The Remotion export path was exercised through the app's Export tab only (the audio is a normal blob audio asset; no Remotion-specific run beyond that export).

