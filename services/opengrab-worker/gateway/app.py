from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .analyzer import Analyzer, YtDlpAnalyzer
from .auth import Caller, authenticate
from .config import QUALITIES, Settings
from .store import ACTIVE, TERMINAL, JobStore, MemoryStore, SupabaseStore
from .upstream import OpenGrabClient, Upstream
from .urlcheck import Resolver, UrlRejected, _resolve, validate_public_url

# Fields returned to apps. upstream ids, internal paths and raw errors from the engine are never exposed.
PUBLIC_FIELDS = ("id", "kind", "status", "stage", "percent", "speed", "eta", "downloaded_bytes", "total_bytes",
                 "title", "source_url", "source_platform", "options", "error", "created_at", "finished_at")


class AnalyzeReq(BaseModel):
    url: str


class JobReq(BaseModel):
    url: str
    quality: str = "best"
    clip_start: float | None = Field(default=None, ge=0)
    clip_end: float | None = Field(default=None, gt=0)
    subs: bool = False
    thumb: bool = False


def _public(row: dict[str, Any]) -> dict[str, Any]:
    return {k: row.get(k) for k in PUBLIC_FIELDS}


def _fail(status: int, code: str) -> HTTPException:
    return HTTPException(status, code)


def create_app(settings: Settings, store: JobStore, upstream: Upstream, analyzer: Analyzer,
               resolver: Resolver = _resolve) -> FastAPI:
    app = FastAPI(title="opengrab-worker", docs_url=None, redoc_url=None, openapi_url=None)

    @app.exception_handler(HTTPException)
    async def _http_error(_: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse({"error": exc.detail}, status_code=exc.status_code)

    def caller(request: Request) -> Caller:
        return authenticate(request, settings)

    def checked_url(raw: str) -> str:
        try:
            return validate_public_url(raw, resolver)
        except UrlRejected as e:
            raise _fail(400, e.code) from None

    async def analyze_or_fail(url: str) -> dict[str, Any]:
        try:
            return await analyzer.analyze(url)
        except asyncio.TimeoutError:
            raise _fail(504, "analyze_timeout") from None
        except Exception:  # extractor errors carry site-specific text; report a stable code instead
            raise _fail(422, "analyze_failed") from None

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/v1/analyze")
    async def analyze(req: AnalyzeReq, who: Caller = Depends(caller)) -> dict[str, Any]:
        info = await analyze_or_fail(checked_url(req.url))
        info["limits"] = {"max_duration_s": settings.max_duration_s, "max_height": settings.max_height}
        info["exceeds_limits"] = bool(
            (info.get("duration") or 0) > settings.max_duration_s or info.get("is_live"))
        return info

    @app.post("/v1/jobs", status_code=201)
    async def create_job(req: JobReq, who: Caller = Depends(caller)) -> dict[str, Any]:
        url = checked_url(req.url)
        if req.quality not in QUALITIES:
            raise _fail(400, "quality_invalid")
        if (req.clip_start is None) != (req.clip_end is None):
            raise _fail(400, "clip_incomplete")
        clip = req.clip_start is not None and req.clip_end is not None
        if clip and (req.clip_end - req.clip_start < 1.0):  # type: ignore[operator]
            raise _fail(400, "clip_invalid_range")
        # Cap resolution: "best" could be 4K, so it is mapped to the configured ceiling.
        quality = req.quality
        if quality == "best" and settings.max_height <= 1080:
            quality = "1080p"
        if quality.endswith("p") and int(quality[:-1]) > settings.max_height:
            raise _fail(400, "quality_too_high")

        if await store.count_active(who.app_id, who.user_id) >= settings.user_active_jobs:
            raise _fail(429, "user_job_limit")
        if await store.count_active() >= settings.global_active_jobs:
            raise _fail(429, "global_job_limit")

        info = await analyze_or_fail(url)
        if info.get("is_live"):
            raise _fail(422, "live_not_supported")
        if info.get("is_playlist"):
            raise _fail(422, "playlist_requires_selection")
        length = (req.clip_end - req.clip_start) if clip else info.get("duration")  # type: ignore[operator]
        if length is None or length > settings.max_duration_s:
            raise _fail(422, "duration_limit" if length else "duration_unknown")

        row = await store.create({
            "app_id": who.app_id, "user_id": who.user_id, "source_url": url,
            "canonical_url": info.get("webpage_url") or url, "source_platform": info.get("platform"),
            "source_media_id": info.get("media_id"), "title": info.get("title"),
            "kind": "audio" if quality == "audio" else ("clip" if clip else "video"),
            "options": {"quality": quality, "clip_start": req.clip_start, "clip_end": req.clip_end,
                        "subs": req.subs, "thumb": req.thumb},
            "status": "queued", "stage": "queued", "percent": 0,
        })
        try:
            uid = await upstream.create_job(url, quality, req.clip_start, req.clip_end, req.subs, req.thumb)
        except httpx.HTTPError:
            await store.update(row["id"], status="failed", stage="failed", error="worker_unavailable")
            raise _fail(503, "worker_unavailable") from None
        await store.update(row["id"], upstream_job_id=uid)
        return _public({**row, "upstream_job_id": uid})

    async def refresh(row: dict[str, Any]) -> dict[str, Any]:
        """Mirror engine progress into the row. Upstream 'done' is NOT final: the file still has to be validated
        and uploaded to storage (not implemented yet), so it is reported as 'processing/finalizing'."""
        if row["status"] in TERMINAL or not row.get("upstream_job_id"):
            return row
        try:
            up = await upstream.get_job(row["upstream_job_id"])
        except httpx.HTTPError:
            return row
        if up is None:
            patch = {"status": "failed", "stage": "failed", "error": "worker_lost_job"}
        else:
            s = up.get("status")
            status = {"queued": "queued", "starting": "queued", "downloading": "downloading",
                      "processing": "processing", "done": "processing", "error": "failed",
                      "cancelled": "cancelled"}.get(s, row["status"])
            patch = {"status": status, "stage": "finalizing" if s == "done" else (s or row["stage"]),
                     "percent": up.get("percent") or 0, "speed": up.get("speed"), "eta": up.get("eta"),
                     "downloaded_bytes": up.get("downloaded"), "total_bytes": up.get("total")}
            if s == "error":
                patch["error"] = "download_failed"  # engine text can contain URLs; not passed through
        await store.update(row["id"], **patch)
        return {**row, **patch}

    @app.get("/v1/jobs/{job_id}")
    async def get_job(job_id: str, who: Caller = Depends(caller)) -> dict[str, Any]:
        row = await store.get(who.app_id, who.user_id, job_id)
        if row is None:
            raise _fail(404, "not_found")
        return _public(await refresh(row))

    @app.get("/v1/jobs")
    async def list_jobs(limit: int = 50, who: Caller = Depends(caller)) -> list[dict[str, Any]]:
        rows = await store.list(who.app_id, who.user_id, max(1, min(limit, 100)))
        return [_public(await refresh(r)) for r in rows]

    @app.post("/v1/jobs/{job_id}/cancel")
    async def cancel_job(job_id: str, who: Caller = Depends(caller)) -> dict[str, Any]:
        row = await store.get(who.app_id, who.user_id, job_id)
        if row is None:
            raise _fail(404, "not_found")
        if row["status"] in ACTIVE:
            if row.get("upstream_job_id"):
                try:
                    await upstream.cancel(row["upstream_job_id"])
                except httpx.HTTPError:
                    raise _fail(503, "worker_unavailable") from None
            await store.update(row["id"], status="cancelled", stage="cancelled")
            row = {**row, "status": "cancelled", "stage": "cancelled"}
        return _public(row)

    return app


def build_from_env() -> FastAPI:
    settings = Settings.from_env()
    sb_url, sb_key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_KEY", "")
    store: JobStore = SupabaseStore(sb_url, sb_key) if sb_url and sb_key else MemoryStore()
    return create_app(settings, store, OpenGrabClient(settings.upstream_url, settings.upstream_token),
                      YtDlpAnalyzer(settings.analyze_timeout_s))
