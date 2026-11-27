# opengrab-worker

Shared media-download worker for SmartVideo AI (remix-new-editor) and SmartVideo GO AI (OpenHiggsBolt).
Design and rationale: `docs/opengrab/DESIGN.md`. Replaces VidBee behind a per-app feature flag; VidBee is untouched.

```
app server (Express / Next.js)  --Bearer <app secret> + X-App-Id + X-User-Id-->  gateway (public)  -->  OpenGrab (127.0.0.1)
```

- `upstream/`: OpenGrab, vendored unmodified (MIT). Pinned commit in `upstream/PINNED_COMMIT`. Not reachable by users.
- `gateway/`: our FastAPI layer. Authenticates the calling app, owns user/job ownership, enforces limits, validates URLs.
- `sql/001_media_download_jobs.sql`: the jobs table. **Not applied**; review first.

## Gateway API (`/v1`, all but `/health` need app auth)

| Route | Purpose |
|---|---|
| `POST /v1/analyze` `{url}` | Metadata only: title, thumbnail, duration, heights, subtitles, playlist entries, limit check |
| `POST /v1/jobs` `{url, quality, clip_start?, clip_end?, subs?, thumb?}` | Create a job (quality: best, 1080p, 720p, 480p, audio) |
| `GET /v1/jobs`, `GET /v1/jobs/{id}` | Owner-scoped list / status (other users' jobs return 404) |
| `POST /v1/jobs/{id}/cancel` | Cancel |
| `GET /v1/jobs/{id}/download-url` | Signed URL once `done` |
| `DELETE /v1/jobs/{id}` | Remove a finished job and its file |

Errors are `{"error": "<code>"}` with stable codes; engine text is never passed through.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `WORKER_APP_SECRETS` | required | `remix:<secret>,ohb:<secret>`; one secret per app |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | none | Job store and storage. Without them in-memory doubles are used (not for production) |
| `STORAGE_BUCKET` / `SIGNED_URL_TTL_S` / `SCRATCH_DIR` | media-downloads / 3600 / /data/scratch | Bucket, signed URL lifetime, temp dir |
| `MAX_DURATION_S` / `MAX_FILE_MB` / `MAX_HEIGHT` | 3600 / 2048 / 1080 | Per-job limits |
| `USER_ACTIVE_JOBS` / `GLOBAL_ACTIVE_JOBS` / `MAX_BATCH` | 2 / 5 / 10 | Concurrency and batch limits |

## Status

Done and tested (55 tests; the media tests run real ffmpeg/ffprobe on generated files): app auth, URL validation, analyze,
job creation with limits, ownership isolation, progress mirroring, cancel, and the **finalize step**:

engine done -> fetch within the size cap -> signature check -> ffprobe validation (streams, duration, clip length) ->
convert only if not already H.264/AAC MP4 (audio: MP3) with fixed ffmpeg arguments -> upload to the private
`media-downloads` bucket -> mark `done`. Any failure sets `failed` with a stable code (`not_media`, `media_corrupt`,
`no_video_stream`, `file_too_large`, `clip_length_mismatch`, `storage_unavailable`, ...). Scratch files and the engine copy
are always removed. Exactly one finalizer runs per job (atomic claim); a background poller finalizes jobs even when
nobody is polling; after a restart, interrupted uploads are retried or failed as `worker_restarted`.
Also: `GET /v1/jobs/{id}/download-url` (short-lived signed URL, owner only) and `DELETE /v1/jobs/{id}` (removes the file and row).

Applied to the shared Supabase project: table `media_download_jobs` (RLS on, no client policies or grants) and the private
bucket `media-downloads`.

**Not verified yet:** the Supabase store and storage calls against the real project (they need the service-role key and
are only exercised with test doubles), the Beam image build, and any real download.

**Not built yet:** egress proxy for DNS-rebinding/redirect protection, SSE endpoint, batch and playlist selection,
subtitle/thumbnail import, duplicate detection, per-user storage quota, app-side API adapters and UI.

```bash
python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt && python -m pytest -q
```
