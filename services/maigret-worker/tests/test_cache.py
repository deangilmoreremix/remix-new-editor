"""Cache tests using the in-memory backend."""

import asyncio
import time

import pytest

from app.cache import MemoryCache


@pytest.mark.asyncio
async def test_set_and_get():
    cache = MemoryCache(ttl_seconds=60)
    await cache.start()
    await cache.set("k", {"hello": "world"})
    val = await cache.get("k")
    assert val == {"hello": "world"}
    await cache.stop()


@pytest.mark.asyncio
async def test_ttl_expiry():
    cache = MemoryCache(ttl_seconds=0)  # already-expired
    await cache.start()
    await cache.set("k", {"x": 1})
    # sleep just a hair to let the entry be in the past
    await asyncio.sleep(0.01)
    val = await cache.get("k")
    assert val is None
    await cache.stop()


@pytest.mark.asyncio
async def test_delete_prefix():
    cache = MemoryCache(ttl_seconds=60)
    await cache.start()
    await cache.set("scan:alice:500:True", {"x": 1})
    await cache.set("scan:bob:500:True", {"x": 2})
    await cache.set("other:key", {"x": 3})
    deleted = await cache.delete_prefix("scan:alice:")
    assert deleted == 1
    assert await cache.get("scan:alice:500:True") is None
    assert await cache.get("scan:bob:500:True") == {"x": 2}
    assert await cache.get("other:key") == {"x": 3}
    await cache.stop()


@pytest.mark.asyncio
async def test_corrupt_json_returns_none():
    cache = MemoryCache(ttl_seconds=60)
    await cache.start()
    cache._store["bad"] = (time.time() + 60, "not-json{")
    val = await cache.get("bad")
    assert val is None
    assert "bad" not in cache._store
    await cache.stop()
