from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import unquote

import httpx

from .media import MediaError


class Upstream(Protocol):
    async def create_job(self, url: str, quality: str, clip_start: float | None, clip_end: float | None,
                         subs: bool, thumb: bool) -> str: ...
    async def get_job(self, upstream_id: str) -> dict[str, Any] | None: ...
    async def cancel(self, upstream_id: str) -> None: ...
    async def download_file(self, upstream_id: str, dest: Path, max_bytes: int) -> str: ...
    async def discard(self, upstream_id: str) -> None: ...


def _filename_from(disposition: str) -> str:
    m = re.search(r"filename\*=(?:UTF-8|utf-8)''([^;]+)", disposition)
    if m:
        return unquote(m.group(1))
    m = re.search(r'filename="?([^";]+)"?', disposition)
    return m.group(1) if m else ""


class OpenGrabClient:
    """Calls the vendored OpenGrab on 127.0.0.1 with its internal token. Never exposed to users.

    Only job create / read / cancel are used. Upstream's global listing, history, settings, engine-update and
    file-system routes are deliberately not wrapped here.
    """

    def __init__(self, base_url: str, token: str, client: httpx.AsyncClient | None = None) -> None:
        self._base = base_url.rstrip("/")
        self._headers = {"Authorization": f"Bearer {token}"} if token else {}
        self._client = client or httpx.AsyncClient(timeout=20)

    async def create_job(self, url: str, quality: str, clip_start: float | None, clip_end: float | None,
                         subs: bool, thumb: bool) -> str:
        body: dict[str, Any] = {"url": url, "quality": quality, "subs": subs, "thumb": thumb,
                                "incognito": False, "infojson": False}
        if clip_start is not None and clip_end is not None:
            body.update(clip_start=clip_start, clip_end=clip_end, clip_precise=True)
        r = await self._client.post(f"{self._base}/api/jobs", json=body, headers=self._headers)
        r.raise_for_status()
        return str(r.json()["job_id"])

    async def get_job(self, upstream_id: str) -> dict[str, Any] | None:
        # Upstream has no single-job read; its list (in-flight + recently finished) is filtered by id here.
        r = await self._client.get(f"{self._base}/api/jobs", params={"recent": "86400"}, headers=self._headers)
        r.raise_for_status()
        return next((j for j in r.json() if j.get("id") == upstream_id), None)

    async def cancel(self, upstream_id: str) -> None:
        r = await self._client.post(f"{self._base}/api/jobs/{upstream_id}/cancel", headers=self._headers)
        if r.status_code not in (200, 404):
            r.raise_for_status()

    async def download_file(self, upstream_id: str, dest: Path, max_bytes: int) -> str:
        """Stream the finished file to `dest`, aborting as soon as it exceeds max_bytes. Returns the engine's file name
        (untrusted: the caller must pass it through safe_filename)."""
        async with self._client.stream("GET", f"{self._base}/api/jobs/{upstream_id}/file", headers=self._headers,
                                       timeout=httpx.Timeout(600, connect=10)) as r:
            r.raise_for_status()
            declared = int(r.headers.get("content-length") or 0)
            if declared > max_bytes:
                raise MediaError("file_too_large")
            total = 0
            with dest.open("wb") as f:
                async for chunk in r.aiter_bytes(1024 * 1024):
                    total += len(chunk)
                    if total > max_bytes:
                        raise MediaError("file_too_large")
                    f.write(chunk)
            return _filename_from(r.headers.get("content-disposition", ""))

    async def discard(self, upstream_id: str) -> None:
        """Remove the finished job and its files from the engine (its history delete also wipes the files)."""
        r = await self._client.delete(f"{self._base}/api/history/{upstream_id}", headers=self._headers)
        if r.status_code not in (200, 404):
            r.raise_for_status()
