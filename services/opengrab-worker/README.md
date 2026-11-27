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

Errors are `{"error": "<code>"}` with stable codes; engine text is never passed through.

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `WORKER_APP_SECRETS` | required | `remix:<secret>,ohb:<secret>`; one secret per app |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | none | Job store. Without them an in-memory store is used (not for production) |
| `MAX_DURATION_S` / `MAX_FILE_MB` / `MAX_HEIGHT` | 3600 / 2048 / 1080 | Per-job limits |
| `USER_ACTIVE_JOBS` / `GLOBAL_ACTIVE_JOBS` / `MAX_BATCH` | 2 / 5 / 10 | Concurrency and batch limits |

## Status

Done and unit-tested (34 tests): app auth, URL validation (private, loopback, metadata, CGNAT, mapped IPv6, credentials, ports),
analyze, job create with limits, ownership isolation, progress mirroring, cancel. The vendored engine boots and rejects calls without its token.

**Not built yet:** finalize step (ffprobe validation, upload to Supabase Storage, cleanup; until then an engine "done" is
reported as `processing/finalizing`, never `done`), egress proxy for DNS-rebinding/redirect protection, SSE endpoint,
batch and playlist selection, subtitles/thumbnail import, restart recovery, duplicate detection, quotas, Beam deploy and real downloads.

```bash
python -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt && python -m pytest -q
```
