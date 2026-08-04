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
import hmac
import logging
import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from starlette.responses import JSONResponse

from .cache import Cache
from .scanner import MaigretScanner, ScanOptions, ScanResult

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

# The client API key. Render's blueprint previously provisioned this under the
# env var name MAIGRET_WORKER_SECRET (and the Netlify personalizer-api/intelligence-api
# functions send that value in X-API-Key). To avoid an auth break when Render keeps the
# old auto-generated secret bound under MAIGRET_WORKER_SECRET, accept either name.
# MAIGRET_API_KEY wins if both are set.
_API_KEY_FROM = None
_env_api_key = os.environ.get("MAIGRET_API_KEY", "").strip()
_env_worker_secret = os.environ.get("MAIGRET_WORKER_SECRET", "").strip()
if _env_api_key:
    API_KEY = _env_api_key
    _API_KEY_FROM = "MAIGRET_API_KEY"
elif _env_worker_secret:
    API_KEY = _env_worker_secret
    _API_KEY_FROM = "MAIGRET_WORKER_SECRET"
else:
    API_KEY = ""
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
    logging.warning("MAIGRET_API_KEY / MAIGRET_WORKER_SECRET not set; all /scan requests will be rejected")
else:
    # Log the source + a short prefix so the operator can copy the SAME value
    # into the Netlify MAIGRET_WORKER_SECRET env var without exposing the full
    # secret to the logs. The prefix is enough to confirm the right key is live.
    logging.info(
        "Maigret worker API key active from %s (prefix=%s...)",
        _API_KEY_FROM, API_KEY[:6],
    )

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

# Per-key rate limiting is enforced manually in the /scan route via
# _check_per_key_rate_limit (sliding 1h window); see MAIGRET_PER_KEY_LIMIT.

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def _scan_cache_key(username: str, top: int, is_parsing_enabled: bool) -> str:
    return f"scan:{username.lower()}:{top}:{is_parsing_enabled}"


async def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> str:
    if not API_KEY:
        raise HTTPException(status_code=503, detail="MAIGRET_API_KEY not configured on server")
    if not x_api_key or not hmac.compare_digest(x_api_key, API_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key")
    return x_api_key


async def require_admin_key(x_api_key: Optional[str] = Header(default=None)) -> str:
    if not ADMIN_KEY:
        raise HTTPException(status_code=503, detail="MAIGRET_ADMIN_KEY not configured on server")
    if not x_api_key or not hmac.compare_digest(x_api_key, ADMIN_KEY):
        raise HTTPException(status_code=401, detail="Invalid or missing admin X-API-Key")
    return x_api_key


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ScanRequest(BaseModel):
    username: Optional[str] = Field(default=None, min_length=1, max_length=100, description="Username to scan (single)")
    usernames: Optional[List[str]] = Field(default=None, description="Multiple usernames to scan")
    top: int = Field(default=500, ge=1, le=2500, description="Max sites to check")
    isParsingEnabled: bool = Field(default=True, description="Parse profile pages for extra data")
    timeoutMs: int = Field(default=15000, ge=1000, le=60000, description="Per-site HTTP timeout")
    enableCloudflareBypass: bool = Field(default=False, description="Include disabled sites / attempt Cloudflare bypass (slower, needs a bypass solver)")
    parseUrl: Optional[str] = Field(default=None, description="Specific URL to also parse")
    useCache: bool = Field(default=True, description="Return cached result if available")
    tags: Optional[List[str]] = Field(default=None, description="Restrict scan to these site tags")
    proxy: Optional[str] = Field(default=None, description="Proxy URL (e.g. socks5://127.0.0.1:1080)")
    retries: int = Field(default=1, ge=0, le=5, description="Retries for temporarily failed requests")
    noRecursion: bool = Field(default=True, description="Disable recursive search by extracted data")
    permute: bool = Field(default=False, description="Permute >=2 usernames to generate more candidates")
    checkDomains: bool = Field(default=False, description="Also check domains on the username")

    @field_validator("username", "usernames")
    @classmethod
    def _validate_usernames(cls, v):
        if v is None:
            return v
        if isinstance(v, str):
            v = v.strip().lstrip("@")
            if not v:
                raise ValueError("username cannot be empty")
            if not all(c.isalnum() or c in "-_." for c in v):
                raise ValueError("username must be alphanumeric with -_. allowed")
        elif isinstance(v, list):
            cleaned = []
            for u in v:
                u = str(u).strip().lstrip("@")
                if not u:
                    continue
                if not all(c.isalnum() or c in "-_." for c in u):
                    continue
                cleaned.append(u)
            if not cleaned:
                raise ValueError("usernames list cannot be empty")
            return cleaned
        return v


class ScanResponse(BaseModel):
    username: str
    usernames: Optional[List[str]] = None
    platforms: List[Dict[str, Any]]
    summary: str
    confidence: float
    cached: bool
    durationMs: int
    sitesChecked: int
    sitesFound: int
    graph: Dict[str, Any] = {}
    warnings: List[str] = []


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    """Liveness/readiness probe. Does not require auth.

    Exposes which env var the active API key came from and a short masked
    prefix so operators can confirm the live key and copy the same value into
    the Netlify MAIGRET_WORKER_SECRET env var (it must match exactly).
    The full secret is never returned.
    """
    return {
        "status": "ok",
        "service": "maigret-worker",
        "version": "1.0.0",
        "cache_backend": CACHE_BACKEND,
        "max_concurrent": MAX_CONCURRENT,
        "scan_timeout_s": SCAN_TIMEOUT,
        "api_key_configured": bool(API_KEY),
        "api_key_source": _API_KEY_FROM,
        "api_key_prefix": (API_KEY[:6] + "...") if API_KEY else None,
    }


@app.post("/scan", response_model=ScanResponse)
async def scan(
    body: ScanRequest,
    api_key: str = Depends(require_api_key),
):
    key_hash = _hash_key(api_key)
    _check_per_key_rate_limit(key_hash)

    # Resolve to list of usernames
    if body.usernames and len(body.usernames) > 0:
        usernames = body.usernames
    elif body.username:
        usernames = [body.username]
    else:
        raise HTTPException(status_code=400, detail="username or usernames required")

    if len(usernames) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 usernames per scan")

    # Use first username for caching
    primary_username = usernames[0]
    cache_key = _scan_cache_key(primary_username, body.top, body.isParsingEnabled)
    logger.info("scan requested usernames=%s key=%s", usernames, key_hash)

    if body.useCache and cache is not None:
        cached = await cache.get(cache_key)
        if cached is not None:
            logger.info("cache hit username=%s", primary_username)
            cached["cached"] = True
            return cached

    options = ScanOptions(
        top=body.top,
        is_parsing_enabled=body.isParsingEnabled,
        timeout_ms=body.timeoutMs,
        enable_cloudflare_bypass=body.enableCloudflareBypass,
        parse_url=body.parseUrl,
        tags=body.tags,
        proxy=body.proxy,
        retries=body.retries,
        no_recursion=body.noRecursion,
        permute=body.permute,
        check_domains=body.checkDomains,
    )

    # Run scans for all usernames
    all_platforms = []
    all_graphs = []
    all_warnings = []
    total_duration = 0
    total_sites_checked = 0
    total_sites_found = 0
    combined_summary = ""
    combined_confidence = 0.0

    async with _scan_semaphore:
        scanner = MaigretScanner(options)
        for uname in usernames:
            try:
                result = await asyncio.wait_for(
                    scanner.scan(uname), timeout=SCAN_TIMEOUT
                )
                all_platforms.extend(result.platforms)
                all_graphs.append(result.graph)
                all_warnings.extend(getattr(result, 'warnings', []) or [])
                total_duration += result.duration_ms
                total_sites_checked += result.sites_checked
                total_sites_found += result.sites_found
                combined_confidence = max(combined_confidence, result.confidence)
            except asyncio.TimeoutError:
                logger.error("scan timed out after %ss username=%s", SCAN_TIMEOUT, uname)
                all_warnings.append(f"Scan timed out after {SCAN_TIMEOUT}s for {uname}")
                # Continue with other usernames
            except Exception as exc:  # noqa: BLE001
                logger.exception("scan failed username=%s", uname)
                all_warnings.append(f"Scan failed for {uname}: {exc}")
                # Continue with other usernames

    if total_sites_found > 0:
        top_platforms = [p["platform"] for p in all_platforms[:5]]
        combined_summary = f"Found {total_sites_found} profile(s) across {len(usernames)} username(s): {', '.join(top_platforms)}"
    else:
        combined_summary = "No profiles found"

    # Combine graphs
    combined_graph = {
        "nodes": [],
        "edges": []
    }
    for g in all_graphs:
        if g:
            combined_graph["nodes"].extend(g.get("nodes", []))
            combined_graph["edges"].extend(g.get("edges", []))

    response = {
        "username": ", ".join(usernames) if len(usernames) > 1 else primary_username,
        "usernames": usernames,
        "platforms": all_platforms,
        "summary": combined_summary,
        "confidence": combined_confidence,
        "cached": False,
        "durationMs": total_duration,
        "sitesChecked": total_sites_checked,
        "sitesFound": total_sites_found,
        "graph": combined_graph,
        "warnings": all_warnings[:50],  # cap warnings
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
    cached = await cache.get(_scan_cache_key(username, 500, True))
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
