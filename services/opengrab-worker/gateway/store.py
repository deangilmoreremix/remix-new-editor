from __future__ import annotations

import time
import uuid
from typing import Any, Protocol

import httpx

ACTIVE = ("queued", "downloading", "processing", "uploading")
TERMINAL = ("done", "failed", "cancelled")
TABLE = "media_download_jobs"


class JobStore(Protocol):
    async def create(self, row: dict[str, Any]) -> dict[str, Any]: ...
    async def get(self, app_id: str, user_id: str, job_id: str) -> dict[str, Any] | None: ...
    async def list(self, app_id: str, user_id: str, limit: int = 50) -> list[dict[str, Any]]: ...
    async def update(self, job_id: str, **fields: Any) -> None: ...
    async def count_active(self, app_id: str | None = None, user_id: str | None = None) -> int: ...
    async def list_active(self, limit: int = 100) -> list[dict[str, Any]]: ...
    async def claim(self, job_id: str, from_status: str, to_status: str, stage_eq: str | None = None,
                    **fields: Any) -> bool: ...
    async def delete(self, job_id: str) -> None: ...


class MemoryStore:
    """In-process store for tests and local runs. Production uses SupabaseStore."""

    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}

    async def create(self, row: dict[str, Any]) -> dict[str, Any]:
        row = {"id": str(uuid.uuid4()), "created_at": time.time(), **row}
        self.rows[row["id"]] = row
        return dict(row)

    async def get(self, app_id: str, user_id: str, job_id: str) -> dict[str, Any] | None:
        r = self.rows.get(job_id)
        # Ownership is part of the lookup: another user's job is indistinguishable from a missing one.
        return dict(r) if r and r["app_id"] == app_id and r["user_id"] == user_id else None

    async def list(self, app_id: str, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        rows = [r for r in self.rows.values() if r["app_id"] == app_id and r["user_id"] == user_id]
        rows.sort(key=lambda r: r["created_at"], reverse=True)
        return [dict(r) for r in rows[:limit]]

    async def update(self, job_id: str, **fields: Any) -> None:
        if job_id in self.rows:
            self.rows[job_id].update(fields)

    async def count_active(self, app_id: str | None = None, user_id: str | None = None) -> int:
        return sum(
            1
            for r in self.rows.values()
            if r["status"] in ACTIVE
            and (app_id is None or r["app_id"] == app_id)
            and (user_id is None or r["user_id"] == user_id)
        )


    async def list_active(self, limit: int = 100) -> list[dict[str, Any]]:
        return [dict(r) for r in self.rows.values() if r["status"] in ACTIVE][:limit]

    async def claim(self, job_id: str, from_status: str, to_status: str, stage_eq: str | None = None,
                    **fields: Any) -> bool:
        """Atomically move a job between statuses; exactly one caller wins."""
        r = self.rows.get(job_id)
        if not r or r["status"] != from_status or (stage_eq is not None and r.get("stage") != stage_eq):
            return False
        r.update(fields, status=to_status)
        return True

    async def delete(self, job_id: str) -> None:
        self.rows.pop(job_id, None)


class SupabaseStore:
    """PostgREST access to media_download_jobs with the service-role key (server side only, never sent to clients)."""

    def __init__(self, url: str, service_key: str, client: httpx.AsyncClient | None = None) -> None:
        self._base = f"{url.rstrip('/')}/rest/v1/{TABLE}"
        self._headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
        self._client = client or httpx.AsyncClient(timeout=15)

    async def _req(self, method: str, params: dict[str, str] | None = None, json: Any = None,
                   extra: dict[str, str] | None = None) -> httpx.Response:
        r = await self._client.request(method, self._base, params=params, json=json,
                                       headers={**self._headers, **(extra or {})})
        r.raise_for_status()
        return r

    async def create(self, row: dict[str, Any]) -> dict[str, Any]:
        r = await self._req("POST", json=row, extra={"Prefer": "return=representation"})
        return dict(r.json()[0])

    async def get(self, app_id: str, user_id: str, job_id: str) -> dict[str, Any] | None:
        r = await self._req("GET", params={"id": f"eq.{job_id}", "app_id": f"eq.{app_id}",
                                           "user_id": f"eq.{user_id}", "limit": "1"})
        rows = r.json()
        return dict(rows[0]) if rows else None

    async def list(self, app_id: str, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        r = await self._req("GET", params={"app_id": f"eq.{app_id}", "user_id": f"eq.{user_id}",
                                           "order": "created_at.desc", "limit": str(limit)})
        return [dict(x) for x in r.json()]

    async def update(self, job_id: str, **fields: Any) -> None:
        await self._req("PATCH", params={"id": f"eq.{job_id}"}, json=fields)

    async def count_active(self, app_id: str | None = None, user_id: str | None = None) -> int:
        params = {"select": "id", "status": f"in.({','.join(ACTIVE)})"}
        if app_id:
            params["app_id"] = f"eq.{app_id}"
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        return len((await self._req("GET", params=params)).json())

    async def list_active(self, limit: int = 100) -> list[dict[str, Any]]:
        r = await self._req("GET", params={"status": f"in.({','.join(ACTIVE)})", "order": "created_at.asc",
                                           "limit": str(limit)})
        return [dict(x) for x in r.json()]

    async def claim(self, job_id: str, from_status: str, to_status: str, stage_eq: str | None = None,
                    **fields: Any) -> bool:
        """Single conditional PATCH: only the caller whose filter still matches gets a row back."""
        params = {"id": f"eq.{job_id}", "status": f"eq.{from_status}"}
        if stage_eq is not None:
            params["stage"] = f"eq.{stage_eq}"
        r = await self._req("PATCH", params=params, json={**fields, "status": to_status},
                            extra={"Prefer": "return=representation"})
        return bool(r.json())

    async def delete(self, job_id: str) -> None:
        await self._req("DELETE", params={"id": f"eq.{job_id}"})
