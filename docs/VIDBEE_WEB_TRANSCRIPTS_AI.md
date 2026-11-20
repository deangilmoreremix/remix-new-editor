# VidBee web app: Transcripts and AI summaries

These two features are added to upstream's web edition (`apps/vidbee/apps/web` + `apps/vidbee/apps/api`),
which upstream ships with only Home, Subscribe, Settings and About. Media Hub (the vendored desktop UI)
is unchanged and still has the full upstream feature set.

## Using it
1. **Download** something on Home. With *Settings → Transcribe after download* on, a transcript starts automatically
   (captions are imported when the video has them; otherwise local speech recognition runs).
2. Open **Transcripts** in the sidebar and pick a download. You get timestamps, speaker names and a search box.
   **Transcribe / Cancel / Retry / Re-transcribe** control the job. **TXT, MD, SRT, VTT** download the transcript.
3. Open the **AI summary** tab. Pick a skill (Overview, Bullet Points, Create Mindmap, Generate FAQ, Extract Statistics,
   Improve Grammar, Paraphrase Content) and press **Run**. The text streams in and is saved per download and skill.

## OpenAI setup
Summaries use the OpenAI **Responses API** (`POST {baseUrl}/responses`, streamed). Set the key either
- in the AI summary tab → *OpenAI settings* (stored on the server in `ai-settings.json` in the data directory, mode 600), or
- with `OPENAI_API_KEY` in the server environment. Optional: `OPENAI_BASE_URL`, `VIDBEE_OPENAI_MODEL` (default `gpt-4.1-mini`).

The key is never returned to the browser. Transcript text is sent to the configured endpoint when you press Run.
Transcripts longer than `VIDBEE_AI_MAX_TRANSCRIPT_CHARS` (default 400000 characters) are refused rather than truncated.

## API
`/rpc/transcripts/*` (statusMap, get, start, cancel, retry, export) and `/rpc/ai/*` (settingsGet, settingsSet, skills, run, get, list, cancel).
Contracts: `apps/vidbee/packages/transcription/src/web-contract.ts`.

## Not included (compared with the desktop UI)
Speaker re-labelling, switching caption languages, editing segments, ASR model management, playback, AI Chat,
the translate / article-rewrite skills (they need the desktop agent's tools), and other AI providers.

## Tested
Against seeded transcripts and a **mock** OpenAI server (streaming, errors, key handling). Not tested: the real OpenAI API,
real speech recognition, Transcribe/Cancel/Retry on a real download, and the sign-in gate in front of the web app.
