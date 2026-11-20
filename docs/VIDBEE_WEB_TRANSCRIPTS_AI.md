# VidBee web app: Transcripts and AI summaries

These two features are added to upstream's web edition (`apps/vidbee/apps/web` + `apps/vidbee/apps/api`),
which upstream ships with only Home, Subscribe, Settings and About. Media Hub (the vendored desktop UI)
is unchanged and still has the full upstream feature set.

## Using it
1. **Download** something on Home. With *Settings → Transcribe after download* on, a transcript starts automatically
   (captions are imported when the video has them; otherwise local speech recognition runs).
2. Open **Transcripts** in the sidebar and pick a download. You get timestamps, speaker names and a search box.
   **Transcribe / Cancel / Retry / Re-transcribe** control the job. **TXT, MD, SRT, VTT** download the transcript.
3. Open the **AI summary** tab. Pick a skill (**Chapters**, Overview, Bullet Points, Create Mindmap, Generate FAQ, Extract Statistics,
   Improve Grammar, Paraphrase Content) and press **Run**. The text streams in and is saved per download and skill.
   **Chapters** returns structured JSON (strict `json_schema`) shown as a list of titled moments and key quotes; click one to open the
   Transcript tab scrolled to, and highlighting, that line. Moments outside the video are dropped and the list is sorted by time.

4. **Chat** tab: ask questions about the video. The model can call read-only tools (`list_transcripts`, `get_video_info`,
   `read_transcript`, `search_transcript`) through OpenAI **function calling**, up to 6 tool rounds per answer, and cites `[m:ss]` timestamps.
   Tool calls are shown in the thread. Tool output is capped at 30,000 characters per call.
5. **Translate** tab: translate the transcript's cues into any language you type and download SRT, VTT or TXT. It uses
   **Structured Outputs** (`text.format` = strict `json_schema`) in batches of 40 cues; every cue index must come back exactly once
   (one automatic retry), so timestamps never shift.

6. **Player**: when the download's file is present, a video/audio player sits above the tabs. It has caption tracks (the transcript and every finished
   translation, via WebVTT), a Web Audio waveform you can click to seek, "Follow playback" highlighting, and clicking a line, chapter or quote seeks and plays.
   `/files` supports byte ranges so seeking does not download the whole file.
7. **Video with subtitles** (Transcript tab): exports the downloaded video with the transcript or a translation as **soft** (selectable track, no re-encode) or
   **burned-in** subtitles using the server's `ffmpeg` (burning needs `libass`). One export runs at a time. Chromium browsers stream the result straight to a file
   you choose (File System Access API); others download a Blob.
8. **Transcribe in your browser** ("From a file" in the sidebar, or on a download that has no transcript): Whisper via Transformers.js, no upload, no speaker names.
   Models: Tiny/Base (English or multilingual) and Small. The model downloads once from the Hugging Face Hub and is cached by the browser. A finished result is kept in
   IndexedDB until the server has saved it, so a failed save can be retried (also after a reload).
9. **Tools** (sidebar): in-browser trim, convert, extract audio, resize/compress, and crop & rotate (Mediabunny + WebCodecs, react-easy-crop). Nothing is uploaded.
   Which outputs work depends on the browser (e.g. some Chromium builds cannot encode AAC/MP3; the page says so and keeps copyable tracks).
10. **Share images**: "Save as image" on a summary or chapters list renders it to a PNG in the browser (html-to-image).
11. **Notifications**: after you press "Notify me", a notification appears when a transcription, summary or translation finishes while the tab is in the background.

## AI prompts: parity with vidbee.org/docs/ai-prompts
Checked against the documentation page, item by item:

| Page says | Web edition |
| --- | --- |
| Built-in prompts: summary, FAQ, stats, translation, mind map, grammar, paraphrase | Yes, with the page's names: Bullet Points, Improve Grammar & Punctuation, Generate FAQ, Extract Statistics, Paraphrase Content, Create a mindmap, Translate (plus Overview and Chapters). Translate here is a single-request prompt; upstream's `translate` skill is an agent workflow that needs tools, so it is not used. The subtitle-aligned version is the Translate tab. |
| Mind map is a Mermaid diagram; statistics is a list and a table | Rendered for real: Markdown (react-markdown + GFM tables, no raw HTML, only http/https/mailto links) and Mermaid (strict security level; drawn once the text is complete). |
| Click a prompt and it starts automatically the first time | Yes (needs a transcript and an API key). |
| Caption tabs next to prompt tabs; extra prompts under **All prompts** | Prompt tabs plus an **All prompts** menu. Default tabs: Chapters, Overview, Generate FAQ, Create a mindmap. |
| Stop, Run again, Copy | Yes. Copy puts the Markdown on the clipboard. |
| Share image: download, copy, or system share sheet | Save as image, Copy image (where the browser allows it) and Share… (where the browser has Web Share). The card has the title and prompt name. |
| Settings → Advanced → Share watermark adds title, author and branding | Uses the same web setting (`shareWatermark`): the footer shows title, author when known, and VidBee. |
| Runs continue when you leave the page | Yes: runs live on the server and results are stored per download and prompt. |
| Elapsed time while running | Yes (seconds counter). |
| Errors explain the problem and link to provider settings | Missing key, rejected key, unaccepted model ID, unreachable provider and empty output each get a plain message and **Open provider settings**. |
| Test connection before saving | Yes, and it works with values typed but not yet saved. |
| Settings → Prompts: hide, Edit (title, icon, instructions), Add prompt, Restore defaults, Run on a sample | Yes, under **Edit prompts**. The Tab checkbox shows or hides a tab. Restore defaults undoes edits to built-ins and keeps your custom prompts. The editor's **Run on a sample** uses a built-in sample interview and saves nothing. Chapters cannot be edited because the page depends on its JSON format. |
| `{{uiLanguage}}` is replaced with the language name (English, 中文) | Yes. |
| "Transcribe anyway" for empty / no-speech files | Yes (the button is relabelled for no-speech). |
| Many providers (OpenAI, Anthropic, Google, xAI, Groq, Deepseek, OpenRouter, Azure, Hugging Face, Ollama, LM Studio, custom OpenAI-compatible) | **Not covered.** OpenAI only, by decision, through the Responses API. A different base URL works only for services that implement `POST /v1/responses`; none were tested. There is no provider catalog or "Use" button. |
| **Thinking** panel showing the model's reasoning | **Not implemented.** Only the elapsed seconds are shown. |
| Share card has a cover image | **Not included** (title, prompt and result only). |
| Prompt titles follow the interface language | **Not localised:** the titles are English. |

## Licences and choices
Mediabunny is MPL-2.0, Transformers.js Apache-2.0, react-easy-crop and html-to-image MIT. **ffmpeg.wasm is not bundled**: the standard `@ffmpeg/core` build is GPL-2.0-or-later,
so features that need ffmpeg run on the server instead. Whisper.cpp WASM is not used; Transformers.js is the one in-browser recognizer. The production build bundles the ONNX runtime
WASM (the `dist/client` folder is about 30 MB); in development it is loaded from jsDelivr.

## OpenAI setup
Summaries, chat and translation use the OpenAI **Responses API** (`POST {baseUrl}/responses`, streamed). Set the key either
- in the AI summary tab → *OpenAI settings* (stored on the server in `ai-settings.json` in the data directory, mode 600), or
- with `OPENAI_API_KEY` in the server environment. Optional: `OPENAI_BASE_URL`, `VIDBEE_OPENAI_MODEL` (default `gpt-4.1-mini`).

Set `VIDBEE_AI_LOCK_SETTINGS=1` to stop the browser from changing the key, model or base URL (recommended whenever the API is reachable by anyone but you:
an open API could otherwise re-point the stored key at another server). The key is never returned to the browser. Transcript text is sent to the configured endpoint when you press Run.
Transcripts longer than `VIDBEE_AI_MAX_TRANSCRIPT_CHARS` (default 400000 characters) are refused rather than truncated.

## Live streaming
Summary and chat text reach the browser as server-sent events from `GET /stream?channel=ai&downloadId=&skillId=` or
`?channel=chat&downloadId=` or `?channel=translate&downloadId=` (a `snapshot`, then `delta` text chunks and `state` updates). If the stream cannot connect, the page falls back to polling.

## API
`/rpc/transcripts/*`, `/rpc/ai/*` (settings, skills, run, get, list, cancel), `/rpc/chat/*` (get, send, cancel, reset) and `/rpc/translate/*` (list, start, cancel, export), `GET /stream`, `GET /export/video?downloadId=&mode=soft|burn&language=` and `GET /files?path=&inline=1` (range requests).
`/rpc/transcripts/importCues` stores a browser-made transcript.
Contracts: `apps/vidbee/packages/transcription/src/web-contract.ts`.

## Not included (compared with the desktop UI)
Speaker names for browser-made transcripts, speaker re-labelling, switching caption languages, editing segments, ASR model management, playback, AI Chat,
the desktop agent's state-changing tools (download queue, settings, clips, frames, dubbing, notes), the article-rewrite skill, and other AI providers.

## Tested
Against seeded transcripts and a **mock** OpenAI server (streaming, errors, key handling, a function-call round trip, strict structured outputs including the retry path). Also exercised with a real `yt-dlp` download of a generated video served over local HTTP: automatic transcription (fake recognizer), Transcribe, force re-transcribe + Cancel, Retry, and the not-found error.
Browser-side features were checked in headless Chromium: the tools with generated media (output durations and sizes verified), real Whisper Tiny on an 11-second speech clip
(text matched the known words; about 4 s model download and 33 s recognition on 4 CPU cores with single-threaded WASM, so slower than real time), the player, notification calls (stubbed `Notification`), the File System
Access save path (stubbed picker) and the Blob fallback, IndexedDB retry across a reload, and the production web server proxying `/stream`, `/export` and range requests.
Not tested: the real OpenAI API (so exact model behaviour, the reasoning-item replay rules for reasoning models, and rate limits are unverified),
server-side speech recognition with real models (the fake recognizer was used), WebGPU, a real (non-stubbed) notification or file-picker dialog, other browsers (Firefox, Safari), and the sign-in gate in front of the web app. The web edition's API has no login of its own (as upstream): keep it on localhost or behind a gate.
