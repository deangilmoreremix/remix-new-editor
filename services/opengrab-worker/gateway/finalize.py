from __future__ import annotations

import logging
import mimetypes
import shutil
import time
from pathlib import Path
from typing import Any

import httpx

from . import media
from .blobs import Blobs
from .config import Settings
from .store import JobStore
from .upstream import Upstream

log = logging.getLogger("worker.finalize")

_EXT_MIME = {".mp4": "video/mp4", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".webm": "video/webm",
             ".mkv": "video/x-matroska", ".ogg": "audio/ogg", ".wav": "audio/wav", ".flac": "audio/flac"}


def content_type(name: str) -> str:
    return _EXT_MIME.get(Path(name).suffix.lower()) or mimetypes.guess_type(name)[0] or "application/octet-stream"


class Finalizer:
    """Turns an engine 'done' into a validated, stored asset.

    A job only becomes 'done' after: file fetched within the size cap -> signature + ffprobe checks pass ->
    converted to H.264/AAC MP4 (or MP3 for audio) only if it is not already compatible -> uploaded to the private
    bucket. Any failure marks the job 'failed' with a stable code. Scratch files are always removed.
    """

    def __init__(self, settings: Settings, store: JobStore, upstream: Upstream, blobs: Blobs) -> None:
        self._s, self._store, self._up, self._blobs = settings, store, upstream, blobs

    async def run(self, row: dict[str, Any]) -> None:
        job_id = row["id"]
        scratch = Path(self._s.scratch_dir) / job_id
        started = time.monotonic()
        try:
            scratch.mkdir(parents=True, exist_ok=True)
            await self._store.update(job_id, stage="fetching")
            src = scratch / "source"
            max_bytes = self._s.max_file_mb * 1024 * 1024
            raw_name = await self._up.download_file(row["upstream_job_id"], src, max_bytes)

            await self._store.update(job_id, stage="validating")
            kind = row["kind"]
            opts = row.get("options") or {}
            clip_len = None
            if opts.get("clip_start") is not None and opts.get("clip_end") is not None:
                clip_len = float(opts["clip_end"]) - float(opts["clip_start"])
            info = await media.probe(src)
            media.check(kind, info, max_bytes=max_bytes, clip_seconds=clip_len)

            final, name = src, media.safe_filename(raw_name or row.get("title"), fallback="media")
            if media.needs_conversion(kind, info):
                await self._store.update(job_id, stage="converting")
                ext = ".mp3" if kind == "audio" else ".mp4"
                final = scratch / f"converted{ext}"
                await media.convert(src, final, kind, info)
                info = await media.probe(final)
                media.check(kind, info, max_bytes=max_bytes, clip_seconds=clip_len)
                name = Path(name).stem + ext
            name = media.safe_filename(name, fallback="media")

            await self._store.update(job_id, status="uploading", stage="uploading", percent=100)
            path = f"{row['app_id']}/{row['user_id']}/{job_id}/{name}"
            await self._blobs.upload(path, final, content_type(name))
            await self._store.update(
                job_id, status="done", stage="done", percent=100, storage_path=path, size_bytes=info.size,
                duration_s=info.duration, width=info.width, height=info.height, vcodec=info.vcodec,
                acodec=info.acodec, finished_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), error=None)
            log.info("job %s finalized in %.1fs (%d bytes, %s)", job_id, time.monotonic() - started, info.size, kind)
        except media.MediaError as e:
            await self._fail(job_id, e.code)
        except httpx.HTTPStatusError as e:
            # 413 means the storage project's upload limit is below the worker's limit, so the file is "too large" there
            await self._fail(job_id, "file_too_large" if e.response.status_code == 413 else "storage_unavailable")
        except httpx.HTTPError:
            await self._fail(job_id, "storage_unavailable")
        except Exception:  # never leak internals to clients; the stable code is enough, details go to the log
            log.exception("job %s: finalize crashed", job_id)
            await self._fail(job_id, "finalize_failed")
        finally:
            shutil.rmtree(scratch, ignore_errors=True)
            try:
                await self._up.discard(row["upstream_job_id"])
            except Exception:
                log.warning("job %s: could not discard engine copy", job_id)

    async def _fail(self, job_id: str, code: str) -> None:
        await self._store.update(job_id, status="failed", stage="failed", error=code,
                                 finished_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
