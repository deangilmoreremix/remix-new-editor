# CineGen server / Electron services → browser classification

Source: `christopherjohnogden/CineGen@769f148` — `web/server/services/*.mjs` (HTTP/media server) and `electron/ipc/*.ts` (desktop IPC).
Classes: **1** browser-native · **2** browser-compatible with existing infra · **3** compatible after replacing the server-dependent step · **4** existing-provider-dependent · **5** native/desktop-only · **6** needs an unapproved backend.
"Target" is where the browser version lives in this app (`src/cinegen/…`). "Difference" records algorithm/capability changes. Nothing here adds a backend.

| Service (web / electron) | Class | Target | Difference / note |
|---|---|---|---|
| media (`media.mjs`, `media-import.ts`, `native-video.ts`) | 3 | `adapters/web-media.ts` | ffmpeg probe/thumbnail/waveform/filmstrip → `<video>`/canvas/WebAudio + CineGen's own `waveform`/`filmstrip` libs; no transcoding to ProRes etc.; proxies are browser-side |
| export (`export.mjs`, `exports.ts`) | 3 | `adapters/web-api.ts` export + Remotion web renderer | ffmpeg → Remotion/WebCodecs (H.264 MP4); no ffmpeg filter graph; export aspect ratio not yet selectable (16:9 only) |
| sync / audio-sync (`sync.mjs`, `audio-sync.ts`) | 3 | `adapters/main-process/audio-sync.ts` | ffmpeg PCM decode → WebAudio `decodeAudioData`; same cross-correlation |
| transcription (`transcription.mjs`, `transcription.ts`) | 3 | `adapters/web-api.ts` → editor's on-device Whisper | local whisper.cpp/cloud → Transformers.js Whisper in the browser (slower, model download) |
| vision (`vision.mjs`, `vision.ts`, `copilot-visual-media.ts`) | 4 | `adapters/main-process/vision.ts` | OpenAI vision on the user's key |
| llm (`llm.mjs`, `openai-llm.ts`, `llm-chat.ts`, `prompts.ts`) | 4 | `adapters/llm-responses.ts`, `main-process/llm-chat.ts` | OpenAI Responses API through the existing Netlify function |
| cut-workflow (`cut-workflow.mjs`) | 2 | `adapters/main-process/llm-chat.ts` `runCutWorkflow` | same prompts/normalisers, OpenAI transport |
| music (`music.mjs`, `music-prompt.ts`) | 4 | `adapters/main-process/music-prompt.ts` + MuAPI | MuAPI music models |
| elements (`elements.mjs`, `elements.ts`, `elements-library.ts`) | 3 | `lib/cloud/elements.ts`, IndexedDB `ProjectStore`, upload adapter | filesystem library → IndexedDB / storage upload |
| workflow (`workflow.mjs`, `workflows.ts`) | 4 | `lib/cloud/funding.ts runWorkflow` | fal/Kie/Topview/Higgsfield submit → MuAPI generic request + OpenAI Images 2.6; image-reference requests route to the `-edit` sibling |
| elevenlabs (`elevenlabs.ts`) | 4 | `adapters/web-elevenlabs.ts` | ElevenLabs → MuAPI speech models; voice design not offered (no MuAPI model) |
| acoustic-analysis | 2 | `adapters/main-process/acoustic.ts` | WebAudio feature extraction + OpenAI interpretation |
| sam3 (`sam3.mjs`, `sam3-server.ts`) | 3 / 5 | on-device SlimSAM/Florence-2 | local SAM3 server is desktop-only; browser segmentation uses different models (not identical masks) |
| local-model, llm-local, local-models, cli-llm-*, codex-cli, gemini-cli, claude-code | 5 | — | Python models, Ollama, CLI chat: desktop-only → NOT_APPLICABLE |
| runpod-ltx25 | 4→removed | — | RunPod pod sessions: provider removed (no new provider) |
| topview, higgsfield, artlist, team-providers | 4→removed | — | providers replaced by MuAPI/OpenAI |
| mcp-bridge, claude-mcp | 5 | — | desktop MCP launcher; the in-app assistant replaces it |
| db, project, file-system | 2 | `adapters/web-store.ts` (IndexedDB) | SQLite → IndexedDB, with one-time legacy import |
| generated-asset-persist | 2 | `web-media.ts persistGeneratedAsset` | files → browser storage / Supabase upload |
| canvas-image-preview, assistant-image-attachments | 1 | `adapters/main-process/vision.ts toVisionImage` | canvas resize |
