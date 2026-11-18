# Fix Q: cross-browser and hardware evidence (Firefox, Safari engine, WebGPU, MusicGen)

Everything below was run in this sandbox on 2026-11-17 against `npx vite --port 5191` of this worktree (headless engines, software GL, no physical GPU).
Smoke scripts are in `docs/stage-11/smoke/` (`engine-probe.cjs`, `whisper-webgpu-smoke.cjs`, `musicgen-smoke.cjs`, and the extended `local-ai-audio-smoke.cjs`).

## 1. Firefox and WebKit

**Obtained.** `PLAYWRIGHT_BROWSERS_PATH=<separate dir> npx playwright install firefox webkit` worked through the sandbox proxy (cdn.playwright.dev reachable): Firefox 159.0 (playwright firefox-1572) and WebKit 27.2 (webkit-2388). The Chromium install was not touched.

### Firefox 159 (headless, run)
Capability probe on the app origin (`engine-probe.cjs`, ENGINE=firefox), compared with Chromium 153:

| probe | Firefox 159 | Chromium 153 |
|---|---|---|
| VideoEncoder / VideoDecoder / AudioEncoder / AudioDecoder / ImageDecoder | all present | all present |
| VideoEncoder.isConfigSupported h264 / vp9 / vp8 / av1 | all true | all true |
| AudioEncoder aac (mp4a.40.2) / opus | false / true | false / true |
| OffscreenCanvas, AudioWorkletNode, MediaRecorder, CompressionStream | present | present |
| IndexedDB, Cache Storage, OPFS | present | present |
| WebAssembly SIMD, shared WebAssembly.Memory | true, true | true, true |
| SharedArrayBuffer / crossOriginIsolated | undefined / false | undefined / false (the dev server sends no COOP/COEP; the app does not need it) |
| WebGL2 | **false** ("AllowWebgl2:false restricts context creation on this system", headless Firefox without GPU) | true (SwiftShader) |
| navigator.gpu (WebGPU) | absent | present (adapter only with `--enable-unsafe-webgpu`, see section 2) |

Real flow in Firefox: `#/timeline`, new project, import clipA.mp4, insert on timeline, add the Exposure effect from the library (panel shows it), Export tab, MP4 render.
Result: the export **completed in 11 s** and the file is valid: H.264 1920x1080 + AAC, 6.0 s, 180 video frames, audio mean -21.1 dB / max -17.6 dB (identical audio stats to the Chromium export).
The AAC track works although `AudioEncoder` has no AAC config in either browser: the renderer's bundled WASM AAC encoder is used (see `containers.ts`).
Because there is no WebGL2 in this headless Firefox, the Exposure GL effect is skipped; the app logs `[clip-fx] WebGL2 is not available: GL effects are skipped and clips render without them (preview and export).` (console only). I did not verify visually whether the Exposure effect changed the Chromium frames; the export was only checked for streams, duration and audio.
Not run in Firefox: real GPU WebGL2, the Local AI models, preview playback quality.

### WebKit / Safari engine (not run)
Downloaded, but it cannot start: `browserType.launch: Host system is missing dependencies to run browsers` (libgtk-4-1, libgraphene-1.0-0, libevent-2.1-7t64, libgstreamer-gl1.0-0, libgstreamer-plugins-bad1.0-0, libavif16, libwayland-server0, libmanette-0.2-0, libenchant-2-2, libsecret-1-0, libgles2). Installing them needs `apt-get`/`playwright install-deps` (root, system packages); that command was refused by the sandbox permission check and I did not try to work around it. So **Safari/WebKit has no test evidence.** I deleted the downloaded WebKit directory afterwards.

**Static analysis only (not a test) for Safari:** the export runner (`src/export-runner/main.jsx`) needs `window.VideoEncoder` for every video container and names the supported floor in its error: "This browser cannot encode video. Use Chrome or Edge 94+, Firefox 130+ or Safari 26+." Audio-only containers need no video encoder. Safari versions before 26 have no WebCodecs VideoEncoder, so by that code path only audio exports would be offered there.

### The app's own "unsupported browser" behaviour (run)
Simulated an engine without WebCodecs (`NO_WEBCODECS=1`, `VideoEncoder`/`VideoDecoder` deleted before the app loads, Chromium):
- Export tab lists MP4, MOV, MKV and WebM as disabled with the text "(not supported by this browser)"; WAV, MP3, AAC, FLAC, Ogg stay selectable.
- Pressing Render anyway (MP4 is still the selected value) gives a job with status **Failed** and the message "This browser cannot encode video. Use Chrome or Edge 94+, Firefox 130+ or Safari 26+." in the render-progress area under the Render button (below the fold at 950 px height).
So it does not fail silently. Small gap left as is: the unsupported MP4 stays the selected default instead of auto-switching to a supported format, and the failure message appears below the Render button. I did not change this (a UI behaviour choice, not a bug).
Also seen once: a first Chromium run **without** the SwiftShader GL flags sat at 0% for 200 s on the same project and never produced a file; with the flags (`combined-lib.cjs` set) it exported in 34 s. The first run was against a just-started dev server, so a cold-server stall is the likely cause, but I did not isolate it.

## 2. WebGPU

**Adapter obtained.** Headless Chromium 153 (full build and headless shell), probed with `navigator.gpu.requestAdapter()` + `requestDevice()`:
- no flags, or only the `combined-lib` GL flags: `navigator.gpu` exists but `requestAdapter()` returns **null**. (This is why earlier smokes always ran WASM.)
- `--enable-unsafe-webgpu` alone: adapter and device obtained: vendor `google`, architecture `swiftshader`, `isFallbackAdapter: true` (CPU software rasteriser, not a GPU). The fuller flag sets (`--enable-features=Vulkan,UseSkiaRenderer --use-angle=swiftshader --use-webgpu-adapter=swiftshader --disable-gpu-sandbox`, and a `--use-vulkan=swiftshader` variant) gave the same adapter.
So everything below ran on a **software** WebGPU adapter: it proves the code path (adapter, device, ONNX WebGPU execution, fallback), not GPU speed.

| Local AI path (device) | Result |
|---|---|
| Kokoro 82M q8 narration, device WebGPU (`local-ai-audio-smoke.cjs`, `WEBGPU=1`) | the card says "running on WebGPU"; narration generated, WAV max -3.8 dB (not silent), clip on timeline, export contains it (max -3.9 dB), reload keeps the blob, cancel/delete flows pass. ALL PASS. |
| Whisper tiny.en via the Local AI panel on WebGPU (`whisper-webgpu-smoke.cjs`) | panel shows "Backend: webgpu", downloads the 117 MB WebGPU variant from huggingface.co (11 s), captions generated, the worker's own reply reports `backend: webgpu` twice. Transcription of 6 s of speech took **155 s** on the software adapter. |
| MusicGen small on WebGPU (see section 3) | 2.9 s clip generated in 746 s |

### WebGPU -> WASM fallback: a real bug found and fixed
Failure injected by making `GPUAdapter.requestDevice()` reject (an adapter exists but a device cannot be created).
- Before the fix, **Kokoro**: the manager's "WebGPU failed, retrying on WASM" retry threw too, and the card showed the error **"9949912"** (a bare number thrown by onnxruntime-web, an exception pointer). The first (WebGPU) attempt threw the same number. After a failed WebGPU start, onnxruntime-web could not create a WASM session in the same page either.
- Before the fix, **Whisper (worker)**: the worker's fallback load also failed with the message "9949912"; the Local AI card went back to "not installed" with a mystery error and no model.
Fix (commit below):
1. `local-ai.worker.js` `webgpuOk()` and `audio-runtime.ts` `hasGpuAdapter()` now prove that `adapter.requestDevice()` works (and destroy the probe device) before choosing WebGPU. When it does not, the model loads on WASM directly in the same page.
2. For failures that only show up at session creation (not covered by the probe), `loadAudioModel` turns a bare non-Error throw into a readable message ("The WebGPU runtime could not start on this device (internal code ...). Reload the page ...") and remembers the failed WebGPU start for the tab in `sessionStorage`, so after a reload capability detection reports no WebGPU and the model loads on WASM. This second path was verified in the browser before step 1 existed (message readable, reload, then installed and generated on WASM); the probe in step 1 now takes that scenario out of reach of my injection, so the sessionStorage path is covered by unit tests only from then on.
After the fix (run): Kokoro with the injected failure shows "running on WASM", narration generated (max -4.8 dB), export contains it, ALL PASS; Whisper with the injected failure downloads the 42 MB WASM weights, captions generated, worker reports `wasm` twice. WebGPU success path re-run for Kokoro: still "running on WebGPU", ALL PASS.
Not tested: a genuine session-creation failure on real hardware (cannot be produced here), device loss in the middle of a generation (no fallback exists for run-time failures: `generate` on a lost device would surface as an error), and any real GPU.

## 3. MusicGen small (742 MB, CC-BY-NC-4.0, licence held by the owner; no licence changes made)

`musicgen-smoke.cjs`: Media tools > Audio > Local AI audio > Music; tick the non-commercial acknowledgement and the download consent; real download from huggingface.co through headless Chromium (no local mirror); prompt "calm lo-fi piano with soft drums", length 3 s.

| | WASM (CPU) | WebGPU (software adapter) |
|---|---|---|
| Download + load | 38 s | 41 s |
| Generate 3 s of music (2.94 s clip) | **32 s** | **746 s** |
| Clip on timeline at 0.0 s, duration | 2.94 s | 2.94 s |
| WAV (mono, 32 kHz, pcm_s16le) volumedetect | mean -20.8 dB, max -2.8 dB | mean -17.6 dB, max -3.9 dB |
| Export (MP4) | audio 2.944 s, mean -20.9 / max -2.8 dB | audio 2.944 s, mean -17.7 / max -3.9 dB |
| Asset metadata | model musicgen-small, licence cc-by-nc-4.0, prompt, kind music | same |
Both runs: ALL PASS (download-disabled-until-ticked, installed, device label, weights in Cache Storage, clip, asset, non-silent WAV, export contains music).
Memory: total Chromium RSS (all processes) was 1.6 GB before the download, about 3.7 GB after load, 3.2 to 3.8 GB during generation, 3.9 GB at the end; no out-of-memory, page crash or tab kill. The machine has 16 GB.
Observed, not a defect of the app logic: Chromium logged "Unable to add response to browser cache: UnknownError: Failed to execute 'put' on 'Cache'" for the largest file (decoder_model_merged_quantized.onnx, 428 MB) in both runs. It only happens in Playwright's default incognito-style context: re-run in a persistent profile, all files including the 428 MB decoder were cached. In that incognito case the model still loads and generates (it comes from the network response), but the next session would re-download that file while the UI would say "downloaded", because `isModelCached` only checks the first cache fragment. I did not change that.
Weight-download hosts (huggingface.co and its CDN) were reachable directly from Chromium through the sandbox proxy.

## Tests and lint
- `npx vitest run src/cinegen`: 239 files passed, 3 skipped; 1885 tests passed, 33 skipped (includes the new `src/cinegen/__tests__/localai/audio-runtime-failure.test.ts`, 4 tests: readable failure message, WebGPU failure memory across a reload, device-not-just-adapter probe).
- eslint on the changed files (`audio-runtime.ts`, `local-ai.worker.js`, the new test): 0 errors; 8 pre-existing `no-unused-vars` warnings on function type signatures in `audio-runtime.ts`.

## What could not be done
- WebKit/Safari: not run (missing system libraries, `apt`/`install-deps` refused by the sandbox).
- Firefox: headless only, no WebGL2 and no WebGPU in this environment, so GL effects, Firefox's local-AI path and real playback were not exercised.
- No physical GPU: WebGPU performance numbers are software-rasteriser numbers.
- The unexplained first-run Chromium export stall (section 1) was not reproduced or diagnosed.
