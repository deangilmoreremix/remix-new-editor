"""
Maigret Worker Service

FastAPI service that wraps the Maigret username OSINT library and exposes
a single `/scan` endpoint that the Netlify `personalizer-api` function
calls with the `X-API-Key` header.

Endpoints:
  POST /scan          — run a Maigret scan for a username
  GET  /health        — health check (no auth)
  GET  /cache/{key}   — inspect a cached result
  DELETE /cache/{key} — invalidate a cached result (admin only)
  GET  /stats         — service stats (admin only)

Environment variables:
  MAIGRET_API_KEY          — required. API key clients must send in X-API-Key
  MAIGRET_ADMIN_KEY        — optional. Separate key for /cache DELETE and /stats
  MAIGRET_CACHE_BACKEND    — "memory" (default) or "redis"
  REDIS_URL                — Redis connection string when MAIGRET_CACHE_BACKEND=redis
  MAIGRET_CACHE_TTL_SECONDS — cache TTL (default 86400 = 24h)
  MAIGRET_MAX_CONCURRENT   — max concurrent scans (default 4)
  MAIGRET_PER_KEY_LIMIT    — scans per key per hour (default 100)
  MAIGRET_SCAN_TIMEOUT     — per-scan timeout in seconds (default 90)
  ALLOWED_ORIGINS          — comma-separated CORS origins (default *)
  PORT                     — port to bind (default 8000)
"""

import asyncio
import hashlib
import logging
import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse

from .cache import Cache
from .scanner import MaigretScanner, ScanOptions, ScanResult

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

API_KEY = os.environ.get("MAIGRET_API_KEY", "").strip()
ADMIN_KEY = os.environ.get("MAIGRET_ADMIN_KEY", "").strip() or API_KEY
CACHE_BACKEND = os.environ.get("MAIGRET_CACHE_BACKEND", "memory").lower()
CACHE_TTL = int(os.environ.get("MAIGRET_CACHE_TTL_SECONDS", "86400"))
MAX_CONCURRENT = int(os.environ.get("MAIGRET_MAX_CONCURRENT", "4"))
PER_KEY_LIMIT = int(os.environ.get("MAIGRET_PER_KEY_LIMIT", "100"))
SCAN_TIMEOUT = int(os.environ.get("MAIGRET_SCAN_TIMEOUT", "90"))
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()
]
PORT = int(os.environ.get("PORT", "8000"))

if not API_KEY:
    # Don't fail at import time so the service can boot for the health check
    # in environments where the key is injected after startup. The auth
    # dependency will reject every request until a key is set.
    logging.warning("MAIGRET_API_KEY is not set; all /scan requests will be rejected")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("maigret-worker")


# ---------------------------------------------------------------------------
# Rate limiting (per API key, sliding 1h window)
# ---------------------------------------------------------------------------

_scan_history: Dict[str, List[float]] = defaultdict(list)
_scan_semaphore = asyncio.Semaphore(MAX_CONCURRENT)


def _check_per_key_rate_limit(key_hash: str) -> None:
    """Reject the request if the API key has exceeded PER_KEY_LIMIT in the last hour."""
    now = time.time()
    window_start = now - 3600
    history = [t for t in _scan_history[key_hash] if t > window_start]
    _scan_history[key_hash] = history
    if len(history) >= PER_KEY_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded: {PER_KEY_LIMIT} scans/hour per API key",
        )
    _scan_history[key_hash].append(now)


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

cache: Optional[Cache] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global cache
    cache = Cache.create(CACHE_BACKEND, ttl_seconds=CACHE_TTL)
    await cache.start()
    logger.info("Cache backend: %s (ttl=%ss)", CACHE_BACKEND, CACHE_TTL)
    logger.info("Listening on port %s", PORT)
    yield
    await cache.stop()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Maigret Worker",
    description="Username OSINT service for the personalizer platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# slowapi limiter is wired up but the per-key limit is enforced in the route
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"error": "rate_limited", "detail": str(exc)},
    )


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


async def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> str:
    if not API_KEY:
        raise HTTPException(status_code=503, detail="MAIGRET_API_KEY not configured on server")
    if not x_api_key or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")
    return x_api_key


async def require_admin_key(x_api_key: Optional[str] = Header(default=None)) -> str:
    if not ADMIN_KEY:
        raise HTTPException(status_code=503, detail="MAIGRET_ADMIN_KEY not configured on server")
    if not x_api_key or x_api_key != ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing admin X-API-Key")
    return x_api_key


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ScanRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100, description="Username to scan")
    top: int = Field(default=500, ge=1, le=2500, description="Max sites to check")
    isParsingEnabled: bool = Field(default=True, description="Parse profile pages for extra data")
    timeoutMs: int = Field(default=15000, ge=1000, le=60000, description="Per-site HTTP timeout")
    enableCloudflareBypass: bool = Field(default=False, description="Try to bypass Cloudflare (slower)")
    parseUrl: Optional[str] = Field(default=None, description="Specific URL to also parse")
    useCache: bool = Field(default=True, description="Return cached result if available")

    @field_validator("username")
    @classmethod
    def _validate_username(cls, v: str) -> str:
        v = v.strip().lstrip("@")
        if not v:
            raise ValueError("username cannot be empty")
        # Maigret expects alnum + common separators
        if not all(c.isalnum() or c in "-_." for c in v):
            raise ValueError("username must be alphanumeric with -_. allowed")
        return v


class ScanResponse(BaseModel):
    username: str
    platforms: List[Dict[str, Any]]
    summary: str
    confidence: float
    cached: bool
    durationMs: int
    sitesChecked: int
    sitesFound: int


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    """Liveness/readiness probe. Does not require auth."""
    return {
        "status": "ok",
        "service": "maigret-worker",
        "version": "1.0.0",
        "cache_backend": CACHE_BACKEND,
        "max_concurrent": MAX_CONCURRENT,
        "scan_timeout_s": SCAN_TIMEOUT,
        "api_key_configured": bool(API_KEY),
    }


@app.post("/scan", response_model=ScanResponse)
async def scan(
    body: ScanRequest,
    api_key: str = Depends(require_api_key),
):
    key_hash = _hash_key(api_key)
    _check_per_key_rate_limit(key_hash)

    cache_key = f"scan:{body.username.lower()}:{body.top}:{body.isParsingEnabled}"
    logger.info("scan requested username=%s key=%s", body.username, key_hash)

    if body.useCache and cache is not None:
        cached = await cache.get(cache_key)
        if cached is not None:
            logger.info("cache hit username=%s", body.username)
            cached["cached"] = True
            return cached

    options = ScanOptions(
        top=body.top,
        is_parsing_enabled=body.isParsingEnabled,
        timeout_ms=body.timeoutMs,
        enable_cloudflare_bypass=body.enableCloudflareBypass,
        parse_url=body.parseUrl,
    )

    async with _scan_semaphore:
        scanner = MaigretScanner(options)
        try:
            result = await asyncio.wait_for(
                scanner.scan(body.username), timeout=SCAN_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error("scan timed out after %ss username=%s", SCAN_TIMEOUT, body.username)
            raise HTTPException(
                status_code=504,
                detail=f"Scan timed out after {SCAN_TIMEOUT}s",
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("scan failed username=%s", body.username)
            raise HTTPException(status_code=500, detail=f"Scan failed: {exc}")

    response = {
        "username": result.username,
        "platforms": result.platforms,
        "summary": result.summary,
        "confidence": result.confidence,
        "cached": False,
        "durationMs": result.duration_ms,
        "sitesChecked": result.sites_checked,
        "sitesFound": result.sites_found,
    }

    if cache is not None:
        await cache.set(cache_key, response)

    return response


@app.get("/cache/{username}")
async def inspect_cache(
    username: str,
    api_key: str = Depends(require_api_key),
):
    if cache is None:
        return {"cached": False}
    cached = await cache.get(f"scan:{username.lower()}:500:True")
    if cached is None:
        return {"cached": False, "username": username}
    return {"cached": True, "username": username, "result": cached}


@app.delete("/cache/{username}")
async def invalidate_cache(
    username: str,
    _admin: str = Depends(require_admin_key),
):
    if cache is None:
        return {"deleted": 0}
    deleted = await cache.delete_prefix(f"scan:{username.lower()}:")
    return {"deleted": deleted, "username": username}


@app.get("/stats")
async def stats(_admin: str = Depends(require_admin_key)):
    now = time.time()
    window_start = now - 3600
    per_key = {
        k: len([t for t in ts if t > window_start])
        for k, ts in _scan_history.items()
    }
    return {
        "scans_last_hour": sum(per_key.values()),
        "active_keys_last_hour": len(per_key),
        "per_key": per_key,
        "max_concurrent": MAX_CONCURRENT,
        "scan_timeout_s": SCAN_TIMEOUT,
        "cache_backend": CACHE_BACKEND,
    }


# ---------------------------------------------------------------------------
# Entrypoint (for `python -m app.main`)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=PORT, log_level="info")
