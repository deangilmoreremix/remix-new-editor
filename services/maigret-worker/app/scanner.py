"""
Maigret scanner — wraps the upstream `maigret` library and converts its
output into the platform/ids_data shape that the personalizer Netlify
function expects.

Maigret is an async Python library that checks a username against ~2500
sites. The library's public surface has changed across versions, so this
module probes for the available entry points at import time and picks the
best one. If Maigret is not importable (e.g., during local dev before
`pip install maigret`), the scanner returns an empty result so the
service can still boot and respond to health checks.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger("maigret-worker.scanner")

# ---------------------------------------------------------------------------
# Optional maigret import — service boots even when the library is missing
# ---------------------------------------------------------------------------

try:
    import maigret  # type: ignore
    _MAIGRET_AVAILABLE = True
    _MAIGRET_VERSION = getattr(maigret, "__version__", "unknown")
    logger.info("maigret library loaded version=%s", _MAIGRET_VERSION)
except Exception as exc:  # noqa: BLE001
    _MAIGRET_AVAILABLE = False
    _MAIGRET_VERSION = None
    logger.warning(
        "maigret library not available (%s); /scan will return empty results", exc
    )


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class ScanOptions:
    top: int = 500
    is_parsing_enabled: bool = True
    timeout_ms: int = 15000
    enable_cloudflare_bypass: bool = False
    parse_url: Optional[str] = None


@dataclass
class ScanResult:
    username: str
    platforms: List[Dict[str, Any]] = field(default_factory=list)
    summary: str = ""
    confidence: float = 0.0
    duration_ms: int = 0
    sites_checked: int = 0
    sites_found: int = 0


# ---------------------------------------------------------------------------
# Maigret invocation
# ---------------------------------------------------------------------------


def _normalize_maigret_result(raw: Any, username: str) -> ScanResult:
    """Convert whatever shape the Maigret library returns into our ScanResult.

    Maigret versions vary in their output. We accept any of:
      - dict with key 'platforms' (list of dicts)
      - list of (site_name, url) tuples
      - MaigretResult / SimilarUsernamesResult object with .sites or .platforms
    """
    platforms: List[Dict[str, Any]] = []

    if raw is None:
        return ScanResult(username=username)

    # Extract the iterable of site records
    sites: Any = None
    if isinstance(raw, dict):
        sites = raw.get("platforms") or raw.get("sites") or raw.get("results")
    elif hasattr(raw, "sites"):
        sites = raw.sites
    elif hasattr(raw, "platforms"):
        sites = raw.platforms
    elif isinstance(raw, (list, tuple)):
        sites = raw

    if not sites:
        return ScanResult(username=username)

    for entry in sites:
        try:
            platform = _extract_platform_name(entry)
            url = _extract_url(entry)
            status = _extract_status(entry)
            ids_data = _extract_ids_data(entry)
            if not platform or not url:
                continue
            platforms.append({
                "platform": platform.lower(),
                "url": url,
                "username": username,
                "status": status or "found",
                "ids_data": ids_data,
            })
        except Exception:  # noqa: BLE001
            continue

    return ScanResult(
        username=username,
        platforms=platforms,
        sites_checked=len(sites) if hasattr(sites, "__len__") else 0,
        sites_found=len(platforms),
    )


def _extract_platform_name(entry: Any) -> Optional[str]:
    if isinstance(entry, dict):
        return entry.get("name") or entry.get("platform") or entry.get("site")
    if isinstance(entry, (list, tuple)) and entry:
        return str(entry[0])
    return getattr(entry, "name", None) or getattr(entry, "platform", None)


def _extract_url(entry: Any) -> Optional[str]:
    if isinstance(entry, dict):
        return entry.get("url") or entry.get("url_main") or entry.get("link")
    if isinstance(entry, (list, tuple)) and len(entry) >= 2:
        return str(entry[1])
    return getattr(entry, "url", None) or getattr(entry, "url_main", None)


def _extract_status(entry: Any) -> Optional[str]:
    if isinstance(entry, dict):
        return entry.get("status")
    return getattr(entry, "status", None)


def _extract_ids_data(entry: Any) -> Dict[str, Any]:
    """Pull bio/company/location/avatar/name out of whatever shape we got."""
    if isinstance(entry, dict):
        ids = entry.get("ids_data") or entry.get("ids") or entry.get("parsed") or {}
        if isinstance(ids, dict):
            return {
                "name": ids.get("name") or ids.get("full_name") or ids.get("title"),
                "bio": ids.get("bio") or ids.get("about") or ids.get("description"),
                "company": ids.get("company") or ids.get("work") or ids.get("employer"),
                "location": ids.get("location") or ids.get("city"),
                "avatar_url": ids.get("avatar_url") or ids.get("image") or ids.get("picture"),
            }
        return {}
    ids = getattr(entry, "ids_data", None) or getattr(entry, "ids", None)
    if isinstance(ids, dict):
        return {
            "name": ids.get("name"),
            "bio": ids.get("bio"),
            "company": ids.get("company"),
            "location": ids.get("location"),
            "avatar_url": ids.get("avatar_url"),
        }
    return {}


# ---------------------------------------------------------------------------
# Maigret execution — async-safe wrapper that runs the synchronous library
# in a thread so we don't block the event loop.
# ---------------------------------------------------------------------------


def _run_maigret_sync(username: str, options: ScanOptions) -> Any:
    """Invoke the Maigret library synchronously. Returns the raw result."""
    if not _MAIGRET_AVAILABLE:
        logger.warning("maigret unavailable — returning empty result")
        return None

    # Try the new Maigret() class API first
    try:
        from maigret import Maigret  # type: ignore

        kwargs = {
            "top_sites": options.top,
            "timeout": options.timeout_ms / 1000,
            "is_parsing_enabled": options.is_parsing_enabled,
            "cookies": None,
        }
        m = Maigret(username, **kwargs)
        if asyncio.iscoroutinefunction(m.run):
            return m  # caller will await
        return m.run() if hasattr(m, "run") else m
    except Exception as exc:  # noqa: BLE001
        logger.debug("Maigret() class API not available: %s", exc)

    # Try the legacy maigret.main() CLI-style entry point
    try:
        import maigret  # type: ignore

        if hasattr(maigret, "main"):
            return maigret.main(
                username,
                top_sites=options.top,
                timeout=options.timeout_ms / 1000,
                is_parsing_enabled=options.is_parsing_enabled,
            )
    except Exception as exc:  # noqa: BLE001
        logger.debug("maigret.main() not available: %s", exc)

    # Try the maigret.check_username convenience function
    try:
        import maigret  # type: ignore
        if hasattr(maigret, "check_username"):
            return maigret.check_username(username, top=options.top)
    except Exception as exc:  # noqa: BLE001
        logger.debug("maigret.check_username() not available: %s", exc)

    logger.error("could not find a working Maigret entry point")
    return None


class MaigretScanner:
    def __init__(self, options: ScanOptions) -> None:
        self.options = options

    async def scan(self, username: str) -> ScanResult:
        started = time.time()
        logger.info("starting scan username=%s top=%d", username, self.options.top)

        # Run the blocking Maigret library in a thread so the event loop
        # stays responsive for other concurrent requests.
        try:
            raw = await asyncio.to_thread(_run_maigret_sync, username, self.options)
        except Exception as exc:  # noqa: BLE001
            logger.exception("maigret execution failed: %s", exc)
            raw = None

        result = _normalize_maigret_result(raw, username)
        result.duration_ms = int((time.time() - started) * 1000)

        # Compute confidence based on yield: 0 found → 0, 1-2 → 0.3, 3-5 → 0.6, 6+ → 0.9
        n = result.sites_found
        if n == 0:
            result.confidence = 0.0
        elif n <= 2:
            result.confidence = 0.3
        elif n <= 5:
            result.confidence = 0.6
        else:
            result.confidence = min(0.95, 0.6 + (n - 5) * 0.03)

        # Build a one-line summary
        if result.platforms:
            top = ", ".join(p["platform"] for p in result.platforms[:3])
            result.summary = f"Found {result.sites_found} profile(s): {top}"
        else:
            result.summary = "No profiles found"

        logger.info(
            "scan complete username=%s found=%d checked=%d duration=%dms",
            username,
            result.sites_found,
            result.sites_checked,
            result.duration_ms,
        )
        return result
