from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
from typing import Protocol
from urllib.parse import quote

import httpx

CHUNK = 1024 * 1024


class Blobs(Protocol):
    async def upload(self, path: str, file: Path, content_type: str) -> None: ...
    async def sign(self, path: str, expires_in: int) -> str: ...
    async def remove(self, path: str) -> None: ...


class MemoryBlobs:
    """Test double: keeps uploaded bytes in memory."""

    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}

    async def upload(self, path: str, file: Path, content_type: str) -> None:
        self.objects[path] = (file.read_bytes(), content_type)

    async def sign(self, path: str, expires_in: int) -> str:
        if path not in self.objects:
            raise FileNotFoundError(path)
        return f"https://storage.test/{quote(path)}?exp={expires_in}"

    async def remove(self, path: str) -> None:
        self.objects.pop(path, None)


async def _chunks(file: Path) -> AsyncIterator[bytes]:
    with file.open("rb") as f:
        while chunk := f.read(CHUNK):
            yield chunk


class SupabaseBlobs:
    """Supabase Storage in one private bucket. Uses the service-role key; the key never leaves this process
    and clients only ever receive short-lived signed URLs."""

    def __init__(self, url: str, service_key: str, bucket: str, client: httpx.AsyncClient | None = None) -> None:
        self._root = f"{url.rstrip('/')}/storage/v1"
        self._bucket = bucket
        self._headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}
        self._client = client or httpx.AsyncClient(timeout=httpx.Timeout(600, connect=15))

    def _obj(self, path: str) -> str:
        return f"{self._root}/object/{self._bucket}/{quote(path, safe='/')}"

    async def upload(self, path: str, file: Path, content_type: str) -> None:
        r = await self._client.post(
            self._obj(path), content=_chunks(file),
            headers={**self._headers, "Content-Type": content_type, "Content-Length": str(file.stat().st_size),
                     "x-upsert": "true", "Cache-Control": "max-age=3600"})
        r.raise_for_status()

    async def sign(self, path: str, expires_in: int) -> str:
        r = await self._client.post(f"{self._root}/object/sign/{self._bucket}/{quote(path, safe='/')}",
                                    json={"expiresIn": expires_in}, headers=self._headers)
        r.raise_for_status()
        return f"{self._root}{r.json()['signedURL']}"

    async def remove(self, path: str) -> None:
        r = await self._client.request("DELETE", f"{self._root}/object/{self._bucket}",
                                       json={"prefixes": [path]}, headers=self._headers)
        r.raise_for_status()
