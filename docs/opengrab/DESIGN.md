# OpenGrab media downloader: design (draft for review)

Status: draft. Nothing here is built yet. VidBee stays in place until this passes acceptance tests.

## 1. Upstream facts (checked in the code, not the README)

- Repo: `Skydope/OpenGrab`, pinned at `59f857aedbebffcf90cc1a9b54b6d0280a3c2af3` (2026-11-02). License: MIT (keep the copyright notice and LICENSE file).
- Stack: FastAPI, `yt-dlp==2026.10.26`, slowapi, prometheus_client. FFmpeg is a system dependency.
- Native routes we can reuse: `POST /api/jobs`, `GET /api/jobs/{id}/events` (SSE), `POST /api/jobs/{id}/cancel`, `GET /api/jobs/{id}/file`, `GET /api/playlist`, `POST /api/playlist/download`, `GET /api/jobs/batch-status`, `GET/DELETE /api/history`. Clips use yt-dlp `download_ranges`.
- It is a single-user tool, not multi-tenant:
  - One shared token (`OPENGRAB_TOKEN`) protects everything.
  - `/api/jobs`, `/api/history` and `/api/jobs/batch-status` are global; there is no per-user concept.
  - Job state lives in process memory plus one SQLite file, so there can be only one instance.
- Built-in SSRF check (`download.py::_is_safe_url`) resolves the hostname once and blocks private, loopback, link-local and reserved IPs. Upstream's own comment admits a DNS-rebinding gap and says to close it with network egress filtering. It does not inspect redirects or secondary media URLs that yt-dlp fetches later.
- Engine-update, filesystem, backup and `open-folder` routes exist. They must never be reachable by users.

## 2. Architecture

```
Browser -> existing server-side API per app -> opengrab-worker (Beam) -> yt-dlp + FFmpeg
                                                     |
                                              Supabase Storage + media_download_jobs
```

- Browsers never call the worker. Each app keeps its own authenticated API layer and adds `/api/media-download/*` routes that forward to the worker with a server-to-server credential.
  - remix-new-editor: the Express backend on Beam (`videoagent-backend`), authenticating with Supabase tokens.
  - OpenHiggsBolt: Next.js route handlers, authenticating with Clerk.
- The worker is one container, one public port:
  - **Gateway** (new, FastAPI): the only thing exposed. It authenticates callers, enforces ownership and limits, and maps everything to upstream.
  - **Upstream OpenGrab**, vendored unmodified under `services/opengrab-worker/upstream/` with a pinned SHA. It listens on 127.0.0.1 with a random internal token. No user can reach it.
- Where the code lives: `services/opengrab-worker/` in this repo (decided). It deploys to Beam on its own, not through Netlify.

## 3. Tenancy and ownership

Both apps share one Supabase project, but their users differ: Supabase auth ids here, Clerk ids in OpenHiggsBolt (to be confirmed in the audit). So the owner key is `(app_id, external_user_id)` as text, not `auth.uid()`.

Table `media_download_jobs` (new migration, applied to the shared project only after review):

- `id`, `app_id`, `user_id`, `upstream_job_id`, `source_url`, `canonical_url`, `source_platform`, `source_media_id`
- `kind` (video, audio, clip, subtitles, thumbnail), `options` (jsonb: quality, clip range)
- `status`, `stage`, `percent`, `speed`, `eta`, `downloaded_bytes`, `total_bytes`, `error`
- `storage_path`, `size_bytes`, `duration_s`, `width`, `height`, `vcodec`, `acodec`
- `import_status`, `created_at`, `finished_at`, `expires_at`

Rules:

- Row-level security is on with no client policies. Only the gateway, using the service-role key kept as a Beam secret, reads or writes it. Apps read job state through their own API.
- The gateway never forwards upstream's global listing, history or batch-status calls. It answers from `media_download_jobs`, filtered by owner.
- Duplicate detection looks up `(app_id, user_id, source_media_id)` only. It never reveals another user's media.

## 4. Job lifecycle

1. `analyze`: the gateway validates the URL, then calls yt-dlp metadata extraction. It returns title, thumbnail, duration, platform, formats, subtitle languages and playlist info. Limits are checked here (max duration, max resolution, estimated size).
2. `jobs`: insert the row, enforce per-user and global concurrency and quotas, then submit to upstream.
3. Progress: the gateway reads upstream SSE and mirrors it into the row. The app streams SSE from its own API, with authenticated polling as the fallback.
4. On `done`: ffprobe validation (container, codecs, duration, size), a normalise-to-H.264/AAC step only if the file isn't editor-compatible, upload to Supabase Storage at `<app>/<user>/<job>/<file>`, then delete the local file. A job is marked complete only after the upload and checks pass.
5. Cancel, retry and delete map to upstream cancel plus row updates. Batch is a loop of jobs under one `batch_id`; playlists require an explicit item selection.
6. Restart recovery: on boot, the gateway marks jobs left in flight as `failed (worker restarted)` or re-queues them. Upstream's SQLite is not trusted as the source of truth.

Worker disk is scratch space only. Durable data lives in Supabase.

## 5. Security (gaps to close beyond upstream)

- Every non-health route requires a per-app server credential plus a user id; no anonymous routes.
- Rebinding, redirects and secondary URLs: run yt-dlp through a small local forward proxy that re-resolves and blocks private, loopback, link-local and cloud-metadata addresses on every connection. This closes what upstream leaves to egress filtering. I have not verified that Beam offers network-level egress rules, so I'm not relying on them.
- Never accept cookies, custom headers, shell arguments or output templates from customers. The gateway builds yt-dlp options from a fixed allowlist.
- Safe filenames, a path check on every file operation, restricted FFmpeg arguments, a non-root container, redacted logs.
- Limits (all configurable): max duration, max resolution, max file size, batch size, per-user and global concurrency, execution timeout, per-user storage quota, temp file expiry.
- A permission-to-download notice in the UI, as specified.

## 6. Hosting on Beam (to verify, not yet proven)

Known: Beam ran our Debian image with yt-dlp and FFmpeg for VidBee, with a persistent disk, scale-to-zero and `max-replicas 1`.

Not yet verified for this design:

- Whether SSE streams pass through Beam's proxy without being cut.
- Whether a long download survives scale-to-zero, since Beam idles a container after the last request. Mitigation: the app's progress polling counts as traffic, and keep-warm is set well above the longest job.
- Whether the per-connection forward proxy works as intended inside the container.
- YouTube and some other sites block cloud IPs. OpenGrab uses the same yt-dlp, so this limit stays; the VidBee deploy already hit it. Cookies from customers are out of scope. Platforms such as Vimeo and Dailymotion are the realistic tests.

Sizing: 1 CPU, 2 GB, `max-replicas 1`. No GPU. Job duration, bytes and stage timings are recorded per job for cost review.

## 7. Rollout

- Env flag per app, `MEDIA_DOWNLOADER=vidbee|opengrab` (default `vidbee`). Rollback means setting it back.
- Order: worker on Beam, then the adapter and flag in remix-new-editor (PR to `develop`), then OpenHiggsBolt (PR to `main`), then UI inside each app's existing downloader surface, then acceptance tests. VidBee is removed only afterwards.
- Existing VidBee downloads and history are not migrated automatically; I'll document what can't carry over.

## 8. Open questions

1. Default limits: proposed max 60 min, 1080p, 2 GB per file, 10 URLs per batch, 2 active jobs per user, 5 globally. Change as needed.
2. Retention: proposed storage kept until the user deletes it, with scratch files cleaned within 1 hour.
3. Is OpenHiggsBolt's user identity Clerk-only, and does it use the same Supabase Storage? To be confirmed in the audit.
