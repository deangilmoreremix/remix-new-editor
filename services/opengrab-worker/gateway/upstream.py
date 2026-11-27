from __future__ import annotations

from typing import Any, Protocol

import httpx


class Upstream(Protocol):
    async def create_job(self, url: str, quality: str, clip_start: float | None, clip_end: float | None,
                         subs: bool, thumb: bool) -> str: ...
    async def get_job(self, upstream_id: str) -> dict[str, Any] | None: ...
    async def cancel(self, upstream_id: str) -> None: ...


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
