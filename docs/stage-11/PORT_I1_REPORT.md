# Port I1: local AI (transcription, scene search, scene captions) with model management

Branch `claude/focused-brown-9xfv3c-portI1`. Scope: FreeCut's local, in-browser pipelines (WebGPU with WASM fallback) ported to CineGen / Remotion. FreeCut's player, renderer and stores were NOT brought in. FreeCut is MIT (Copyright (c) 2025 FreeCut), pinned at `5ceeeb388eef5423640b7db157706274bf1b8165`; the project owner confirmed the licence rights for the port.

## What was built

| Area | Where | Notes |
| --- | --- | --- |
| Model catalogue | `src/cinegen/lib/local-ai/catalog.ts` | name, purpose, size per backend, licence (name, URL, how it was checked, date), source URL, enabled flag. `isDownloadable()` refuses anything not `verified` / `verified-base`. |
| Capability check | `capabilities.ts` | WebGPU adapter, WebAssembly, SIMD (validated probe module), cross-origin isolation / SharedArrayBuffer (threads), IndexedDB, OPFS, storage quota estimate. Pure over an injectable environment. |
| Consent | `consent.ts` | per-model consent bound to a fingerprint of (id, repo, licence name, licence status); a changed licence re-asks. `ConsentRequiredError`. |
| Cache | `model-cache.js` (+ `.d.ts`) | IndexedDB blob store plugged into transformers.js as `env.customCache`; per-repo usage, per-repo delete, completion markers (a cancelled / failed download leaves no marker and no files). Plain JS because the app's dev server does not strip TypeScript from module-worker graphs. |
| Manager | `manager.ts` | install state, serial FIFO queue, consent / licence / capability / quota gates, progress, cancel (queued or running), delete (files + marker + consent). |
| Worker | `local-ai.worker.js`, `worker-client.ts`, `worker-protocol.ts` | one module worker for Whisper, CLIP, SmolVLM; WebGPU when an adapter exists, else WASM; abort terminates the worker (the only way to stop a load or an inference). |
| Transcription | `whisper-words.ts`, `transcript.ts`, `transcribe.ts`, `clip-transcribe.ts` | see "Transcription: existing vs ported". |
| Scene search | `scene-index.ts`, Stage 4 `scenes-panel.tsx` | CLIP image + text embeddings, cosine ranking, merged with the existing metadata search; optional SmolVLM captions stored on the scene (`SceneInfo.caption`, searchable). |
| UI | `stage4/local-ai-panel.tsx`, `stage4-dock.tsx` | new "Local AI" tab in Media tools: capability line, every model with purpose / size / licence / how verified / source link, Download then an explicit "Accept licence and download", progress + Cancel, Delete. Hover help entries added. |
| Call sites | `occ/captions.ts`, `clip-captions-section.tsx`, `clip-analyze-section.tsx`, `adapters/web-api.ts` | CineGen's four transcription call sites now use the new pipeline (no implicit download; a Cancel button was added to Generate captions). |

## Models (licence check)

Licences were read on 2026-11-15 from the upstream repos: `curl https://huggingface.co/<repo>/raw/main/README.md` (model-card front matter), `curl https://huggingface.co/api/models/<repo>` (`cardData.license`, file listing and sizes), and for Whisper / CLIP the GitHub `LICENSE` files (both MIT). The Hugging Face proxy path was reachable, so nothing is "unverified because unreachable".

| Model id | Repo downloaded | Purpose | Size (measured / listed) | Licence | Verified? How | Offered? |
| --- | --- | --- | --- | --- | --- | --- |
| whisper-tiny-en | `onnx-community/whisper-tiny.en_timestamped` | ASR, word timestamps, English | 41 MB (WASM q8; measured 10 + 30 MB ONNX + tokenizer files) / about 120 MB WebGPU (encoder fp32 + decoder q4, not measured here) | Apache-2.0 (base `openai/whisper-tiny.en`) | verified-base: the ONNX repo has no licence field; its base model card says `license: apache-2.0` | yes, after consent |
| whisper-tiny | `onnx-community/whisper-tiny_timestamped` | ASR, ~99 languages | same sizes | Apache-2.0 (base `openai/whisper-tiny`) | verified-base (same reasoning) | yes, after consent |
| whisper-base | `onnx-community/whisper-base_timestamped` | ASR, ~99 languages, better accuracy (previous editor default) | 77 MB WASM / about 206 MB WebGPU (listed, 76 MB observed installed in the smoke) | Apache-2.0 (base `openai/whisper-base`) | verified-base | yes, after consent |
| clip-vit-b32 | `Xenova/clip-vit-base-patch32` | image + text embeddings for scene search | measured 147 MB of model files (85 MB vision + 62 MB text) plus tokenizer | MIT | verified: card front matter `license: mit` on the downloaded repo | yes, after consent |
| smolvlm-256m | `HuggingFaceTB/SmolVLM-256M-Instruct` | one-sentence scene captions (English) | measured 251 MB (131 + 90 + 27 MB) | Apache-2.0 | verified: card front matter on the downloaded repo | yes, after consent |
| lfm2.5-vl-450m | `LiquidAI/LFM2.5-VL-450M-ONNX` | FreeCut's captioner | n/a | LFM Open License v1.0 (`license: other`; LICENSE defines a USD 10M annual-revenue threshold and a Commercial Use limitation) | restricted | NO: listed with the reason, no download button, `enabled:false` |
| gemma-4-e4b | `onnx-community/gemma-4-E4B-it-ONNX` | FreeCut's scene verifier | n/a (repo is about 74 GB of ONNX variants) | card says Apache-2.0 but its `license_link` points to Google's Gemma terms; not reconciled | unverified | NO: not enabled |

Not ported at all: FreeCut's Parakeet TDT 0.6B v3 default engine (`nvidia/parakeet-tdt-0.6b-v3`, CC-BY-4.0 on the card, but a custom hybrid WebGPU-encoder + WASM-decode ONNX pipeline of about 13 GB of repo files; out of scope for a browser port here; Whisper is used instead), Kokoro / MOSS TTS, MusicGen (Meta weights are CC-BY-NC), CLAP.

Whisper note: the Hugging Face model cards of `openai/whisper-*` say `license: apache-2.0`; the openai/whisper GitHub repo LICENSE is MIT. Both are permissive; the UI shows the card's value. Nothing is bundled in the repo; weights are fetched from huggingface.co only after the user presses "Accept licence and download".

## Transcription: existing vs ported

Existing (`src/lib/editor/remotion/transcribe.js` + worker): decodes the whole clip, one worker call with `chunk_length_s 30 / stride 5`, no real progress (a single number), cancel only by terminating the worker, silent model download on first use, word timestamps taken as given (a `null` end timestamp would crash or drop the word), no overlap handling, models hard-coded to whisper-base / tiny.

Ported from FreeCut (adapted, attribution headers in each file):
- `resolveWhisperWordTimings`: words with a missing start or end are kept with an inferred span instead of dropped.
- 120 s spans with a 2 s overlap (`planSpans`) and `OverlapDeduper`: real chunk-level progress, cancel between spans, bounded memory per call, no duplicate words at the seams.
- WebGPU batch size per model size is passed to the worker; WebGPU initialisation failure falls back to WASM.
- English-only models are called without `task` / `language` (a bug found by the real browser run: transformers.js throws otherwise).
- Output: words, text, segments (sentence / pause / 18 words), Remotion `Caption[]` in ms with the leading-space convention, so the existing caption styles and the Stage 2 text-motion presets work unchanged (unit-tested against every `CAPTION_STYLES` template and every `CAPTION_MOTION_OPTIONS` preset; and shown in the real inspector).
- Not ported: FreeCut's pause-while-the-timeline-plays watcher, worker pool, runtime-status store.
- Language detection: Whisper auto-detects per 30 s window inside transformers.js, but the pipeline does not expose the detected code. `TranscribeResult.language` is the requested code, `'en'` for English-only models and `null` when auto-detected. A language picker is not exposed in the UI yet (the option exists on `transcribeLocal`).

## What ran for real vs mocked

Real (headless Chromium 153 via Playwright, vite dev server, models downloaded from huggingface.co, no WebGPU adapter in this container so everything ran on WASM, single-threaded; script `docs/stage-11/smoke/i1-real.cjs`, dev-server wrapper `vite.i1.config.mjs`, inputs built from a public-domain JFK sample (HF `Xenova/transformers.js-docs/jfk.wav`, 11 s) and four sample photos):
- Local AI panel through the real `#/timeline` page: 7 models listed, capability line (WebGPU no, WASM yes, SIMD yes, threads no, IndexedDB yes, OPFS yes), the restricted model has no download button, the consent prompt shows size / source URL / licence, Accept downloads, status "installed", files are in IndexedDB, Delete returns to "not installed".
- Cancel of a real SmolVLM download mid-flight: model returns to "not installed" and IndexedDB holds 0 model files.
- REAL transcription of the JFK clip with `whisper-tiny.en`: "And so my fellow Americans ask not what your country can do for you ask what you can do for your country." 22 words with timestamps 0.78 s to 10.74 s, 3.7 to 5.2 s on WASM; a second run aborted after 300 ms rejects with `AbortError`.
- Real inspector path (Add scene to timeline, select the clip, Captions > Generate captions) with the installed model, followed by changing the caption style and the motion preset on the result (see the log lines in "Results" below).
- Real CLIP scene search on the 4-scene clip: semantic query top-1 was correct for 3 of 4 queries (tiger, beach, football) and the city scene was top-2 for "a city street with buildings"; the beach photo contains an open book titled "New York City", which CLIP reads, and the scores were 22 % vs 21 %. CLIP is a weak ranker on four images; this is a plumbing and sanity result, not a benchmark.
- Real SmolVLM captions (4 scenes, 33 s on WASM): "a tiger sitting on the ground", "A beach towel with a straw hat...", "The image is taken in a city...", "two men on the ground...".

Mocked (unit tests, `src/cinegen/__tests__/localai/*`, 32 tests): manager / queue / consent / licence gate / quota / capability / cancel / delete / error and retry logic with a mock loader; the IndexedDB cache contract with an in-memory store (the real IndexedDB path ran in the browser smoke); transcription chunking, overlap de-duplication, cancellation and error paths with a fake worker; semantic ranking, indexing batches and captions with a fake worker. The jsdom `Blob` is not a Node `Blob`, so tests use `Uint8Array` response bodies.

NOT run: WebGPU (no adapter here, so the WebGPU dtype `{encoder fp32, decoder q4}` path and the WebGPU download sizes are untested and the sizes are estimates), multi-threaded WASM (the app sets no COOP/COEP), Safari / Firefox, a production build (`vite build`) of the new worker, whisper-base / whisper-tiny multilingual real transcription (only the English-only tiny model was run for real; language handling for multilingual models is covered by the mocked worker test only), real-browser quota rejection (unit-tested only), the legacy `TimelineEditorPage.jsx` editor (not changed, still downloads Whisper silently through the old `transcribe.js`; it is not CineGen).

## Capabilities and what works without COOP/COEP

`crossOriginIsolated` is false (neither vite nor `netlify.toml` sends COOP / COEP). Consequences:
- onnxruntime-web WASM runs single-threaded (SIMD still on). Whisper tiny.en transcribed an 11 s clip in 3.7 to 5.2 s, SmolVLM captions took about 8 s per thumbnail. Larger models will be proportionally slower.
- WebGPU does not need cross-origin isolation, so on machines with an adapter the Whisper encoder runs on the GPU (untested here).
- Turning on threads would need `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`) on the app, which would break third-party embeds (Clerk, Supabase storage, fonts, image CDNs) unless each is CORP/CORS-enabled. Not changed; documented only. The panel states this to the user.
- The ONNX Runtime WASM binary (about 26 MB) is fetched from cdn.jsdelivr.net by transformers.js (already allowed by the dev CSP `script-src`) and is cached in the same IndexedDB under `_other`; it is shared by all models, so "Delete model" does not remove it and it counts toward the "Used" figure.

## Limits and known issues

- Cancel works by terminating the worker; a half-loaded model must be reloaded on the next use. Partial files are deleted. Downloads are not resumable.
- Storage: the quota check needs `navigator.storage.estimate()` and 10 % headroom over the catalogue size; Chromium reports quota generously, so this is mostly a guard for small-quota browsers. Persistent storage (`navigator.storage.persist()`) is not requested, so the browser may evict the cache under pressure (the model then shows installed until a use fails; the next Download re-fetches). OPFS is detected and reported, but the cache is IndexedDB.
- `Download` sizes for WebGPU are estimates from the file listing.
- SmolVLM runs with `do_image_splitting: false` (one 512 px tile). With splitting on, the headless renderer crashed twice (memory) in this container.
- Semantic search embeds the stored scene thumbnails (one mid-scene frame, small JPEG), so it finds what is visible in that frame only; captions are English only.
- Index vectors are kept in memory per session (re-index after a reload; embedding 4 thumbnails took 2 s). Persisting them in the thumbnail cache is a follow-up.
- No language picker or model picker in the caption UI yet: the best installed model is chosen automatically (`pickInstalledAsr`), and when none is installed the user is told to open Media tools > Local AI.
- The dev server needs the `vite.i1.config.mjs` wrapper only because this worktree's `node_modules` is a symlink shared with other dev servers (shared `.vite` cache gives 504 "Outdated Optimize Dep" for module workers, and `/@fs` access to the real path). It is not needed in a normal checkout.
- Two environment hazards seen while testing: other agents' dev servers / the container's cgroup OOM killer terminated Chromium and crashed pages several times, so some runs were repeated. The recorded results are from complete runs.

## Verification run

- `npx vitest run src/cinegen src/openchatcut src/lib/editor`: 327 files passed, 3 skipped; 2772 tests passed, 33 skipped, 0 failed (includes the new `src/cinegen/__tests__/localai/*`, 32 tests, the help-coverage test and the timeline-editor parity budget test).
- `npx eslint` on every changed / new file under `src/cinegen`: 0 errors (the warnings are `no-unused-vars` on TypeScript type signatures, the same as the existing TS files). The standalone `tsc` check of the new files (temporary tsconfig, the repo's own tsconfig does not cover `src/cinegen`) reported no errors in them.
- Real-browser logs: `docs/stage-11/smoke/i1-real-results.log` (runs 12, 14, 15, 23; each stage was run separately because the shared container OOM-killed Chromium on longer runs); script `docs/stage-11/smoke/i1-real.cjs` (`STAGES=cancel,asr,clip,caption,uicap,delete`).

### Results (excerpts of `i1-real-results.log`)
- cancel: SmolVLM download cancelled at "downloading 1%", then "not installed" and 0 files in IndexedDB.
- asr: transcript "And so my fellow Americans ask not what your country can do for you ask what you can do for your country." (22 words, 0.78 s to 10.74 s, 3.7 s on WASM), second run aborted with `AbortError`.
- clip: queries "a tiger", "a beach by the sea", "a football match" ranked the right scene first; "a city street with buildings" ranked the beach photo first (22 % vs 21 %, the beach photo contains a book titled "New York City") and the city scene second. This assertion FAILED in the strict top-1 form and is recorded as such; the top-2 assertion passed.
- caption: 4 scenes captioned in 33 s.
- uicap: inspector Generate captions gave 5 words for the 2 s scene; style tiktok to bold-outline and motion pop to char-rise were applied on the result.
