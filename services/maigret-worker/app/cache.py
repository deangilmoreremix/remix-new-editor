"""
Async cache backends for Maigret scan results.

Two backends are supported:
  - "memory"  : in-process LRU with TTL (default; good for single-instance deploys)
  - "redis"   : Redis-backed (good for multi-instance / horizontal scale)

The cache is intentionally write-through with a TTL so the same username
scan never runs more than once per TTL window. Bump the TTL up for
production if scan cost is high and the contact universe is small.
"""

import asyncio
import json
import logging
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

logger = logging.getLogger("maigret-worker.cache")


class Cache(ABC):
    @classmethod
    def create(cls, backend: str, ttl_seconds: int) -> "Cache":
        backend = backend.lower().strip()
        if backend == "redis":
            return RedisCache(ttl_seconds=ttl_seconds)
        return MemoryCache(ttl_seconds=ttl_seconds)

    @abstractmethod
    async def start(self) -> None: ...

    @abstractmethod
    async def stop(self) -> None: ...

    @abstractmethod
    async def get(self, key: str) -> Optional[Dict[str, Any]]: ...

    @abstractmethod
    async def set(self, key: str, value: Dict[str, Any]) -> None: ...

    @abstractmethod
    async def delete_prefix(self, prefix: str) -> int: ...


class MemoryCache(Cache):
    """Process-local async-safe cache. Simple but doesn't scale horizontally."""

    def __init__(self, ttl_seconds: int) -> None:
        self._ttl = ttl_seconds
        self._store: Dict[str, tuple[float, str]] = {}
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        logger.info("memory cache ready (ttl=%ss)", self._ttl)

    async def stop(self) -> None:
        async with self._lock:
            self._store.clear()

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        async with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            expires_at, payload = entry
            if expires_at < time.time():
                self._store.pop(key, None)
                return None
            try:
                return json.loads(payload)
            except json.JSONDecodeError:
                self._store.pop(key, None)
                return None

    async def set(self, key: str, value: Dict[str, Any]) -> None:
        async with self._lock:
            self._store[key] = (time.time() + self._ttl, json.dumps(value, default=str))

    async def delete_prefix(self, prefix: str) -> int:
        async with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                self._store.pop(k, None)
            return len(keys)


class RedisCache(Cache):
    """Redis-backed cache. Lazily connects; degrades to memory cache if unreachable."""

    def __init__(self, ttl_seconds: int) -> None:
        import os

        self._ttl = ttl_seconds
        self._url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        self._client = None
        self._fallback: Optional[MemoryCache] = None

    async def start(self) -> None:
        try:
            import redis.asyncio as aioredis

            self._client = aioredis.from_url(self._url, decode_responses=True)
            await self._client.ping()
            logger.info("redis cache connected url=%s ttl=%ss", self._url, self._ttl)
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis unavailable (%s) — falling back to memory cache", exc)
            self._client = None
            self._fallback = MemoryCache(ttl_seconds=self._ttl)
            await self._fallback.start()

    async def stop(self) -> None:
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception:  # noqa: BLE001
                pass
        if self._fallback is not None:
            await self._fallback.stop()

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        if self._client is None:
            return await self._fallback.get(key) if self._fallback else None
        try:
            raw = await self._client.get(key)
            return json.loads(raw) if raw else None
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis get failed: %s", exc)
            return None

    async def set(self, key: str, value: Dict[str, Any]) -> None:
        if self._client is None:
            if self._fallback:
                await self._fallback.set(key, value)
            return
        try:
            await self._client.set(key, json.dumps(value, default=str), ex=self._ttl)
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis set failed: %s", exc)

    async def delete_prefix(self, prefix: str) -> int:
        if self._client is None:
            return await self._fallback.delete_prefix(prefix) if self._fallback else 0
        try:
            count = 0
            async for key in self._client.scan_iter(match=f"{prefix}*"):
                await self._client.delete(key)
                count += 1
            return count
        except Exception as exc:  # noqa: BLE001
            logger.warning("redis scan_iter failed: %s", exc)
            return 0
