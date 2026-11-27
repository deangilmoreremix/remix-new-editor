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
| `STORAGE_BUCKET` / `SIGNED_URL_TTL_S` / `SCRATCH_DIR` | media-downloads / 900 / /data/scratch | Bucket, signed URL lifetime, temp dir |
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

**Known limit:** Supabase's CDN caches signed-URL responses regardless of cache headers (observed: `cf-cache-status: HIT` after the object was deleted). A signed link that was already issued can keep working for a while after `DELETE`. New links for a deleted file are refused. Links therefore live 15 minutes by default and are never stored or logged.

**Verified for real** (Beam deploy, a CC-BY video from archive.org, real Supabase table and bucket): analyze; a 60 s clip
(H.264/AAC MP4, 640x360, video and audio streams both 60.000 s); a 40 s audio clip delivered as MP3 (43.97 s: the engine cuts audio
at segment boundaries, so audio clips can run a few seconds long); signed-link download; other user / other app get 404;
unauthenticated access to the private object is refused; the engine is not reachable from outside the container; test rows and
objects removed afterwards.

**Supabase upload limit:** the project's global upload limit is about 50 MB (a 59 MB upload returned 413 "EntityTooLarge" even though the
bucket allows 2 GB). The worker therefore runs with `MAX_FILE_MB=48` and reports larger files as `file_too_large`. To allow bigger
files, raise the limit in the Supabase dashboard (Storage settings; needs a plan that allows it), then raise `MAX_FILE_MB`.

**Not verified yet:** playlists, batch, subtitles and thumbnails, restart recovery on Beam, scale-to-zero behaviour during a long
download, and sites that block datacenter IPs (YouTube).

**Not built yet:** egress proxy for DNS-rebinding/redirect protection, SSE endpoint, batch and playlist selection,
subtitle/thumbnail import, duplicate detection, per-user storage quota, app-side API adapters and UI.

```bash
python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt && python -m pytest -q
```
