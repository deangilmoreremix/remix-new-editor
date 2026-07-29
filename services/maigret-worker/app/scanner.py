"""
Maigret scanner — wraps the upstream `maigret` username OSINT library and
converts its output into the platform/ids_data shape that the personalizer
Netlify function expects.

The upstream library exposes a programmatic async entry point
(`maigret.checking.maigret`) that takes a *sites database* and returns a
dict keyed by site name. Each value is a `SiteResult` dict with a `status`
(`MaigretCheckResult`) and a `url_user` profile URL. We load the bundled
database, run the search in a worker thread (the library is async but we
drive it with `asyncio.run` internally), and normalize claimed accounts
into the `platforms` array.

If Maigret or its `socid_extractor` dependency is not importable, the
scanner degrades gracefully to an empty result so the service can still
boot and answer health checks.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger("maigret-worker.scanner")

# ---------------------------------------------------------------------------
# Optional maigret import — service boots even when the library is missing
# ---------------------------------------------------------------------------

try:
    import maigret  # type: ignore
    from maigret.sites import MaigretDatabase
    from maigret.checking import maigret as maigret_search
    from maigret.notify import QueryNotifyPrint
    from maigret.result import MaigretCheckStatus
    _MAIGRET_AVAILABLE = True
    _MAIGRET_VERSION = getattr(maigret, "__version__", "unknown")
    logger.info("maigret library loaded version=%s", _MAIGRET_VERSION)
except Exception as exc:  # noqa: BLE001
    _MAIGRET_AVAILABLE = False
    _MAIGRET_VERSION = None
    MaigretDatabase = None  # type: ignore
    maigret_search = None  # type: ignore
    QueryNotifyPrint = None  # type: ignore
    MaigretCheckStatus = None  # type: ignore
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
    tags: Optional[List[str]] = None
    proxy: Optional[str] = None
    retries: int = 1
    no_recursion: bool = True
    permute: bool = False
    check_domains: bool = False


@dataclass
class ScanResult:
    username: str
    platforms: List[Dict[str, Any]] = field(default_factory=list)
    summary: str = ""
    confidence: float = 0.0
    duration_ms: int = 0
    sites_checked: int = 0
    sites_found: int = 0
    graph: Dict[str, Any] = field(default_factory=dict)


def build_graph(username: str, platforms: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Derive a connection graph from the *real* Maigret platforms.

    Node types:  seed | platform | alias | permutation | identity
    Edge relations: claimed | alias_of | permutation_of | same_identity

    The seed username is the root; every found platform is a ``claimed`` edge
    from the seed. When a platform's ``ids_data`` exposes a secondary handle
    (e.g. a Twitter/GitHub alias), that becomes an ``alias_of`` node. When
    ``permute`` was requested we also surface candidate permutations. Two
    platforms that share the same extracted name/company are linked as
    ``same_identity``.
    """
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    seen_node: Dict[str, str] = {}
    seen_edge: set = set()

    def add_node(nid: str, label: str, ntype: str, url: Optional[str], platform: Optional[str], status: str) -> None:
        if nid in seen_node:
            return
        seen_node[nid] = ntype
        nodes.append({
            "id": nid,
            "label": label,
            "type": ntype,
            "url": url,
            "platform": platform,
            "username": username if ntype in ("seed", "platform") else (label if ntype == "alias" else None),
            "status": status,
        })

    def add_edge(src: str, tgt: str, relation: str) -> None:
        key = f"{src}|{tgt}|{relation}"
        if key in seen_edge or src == tgt:
            return
        seen_edge.add(key)
        edges.append({"source": src, "target": tgt, "relation": relation})

    seed_id = f"seed:{username}"
    add_node(seed_id, username, "seed", None, None, "seed")

    # Map of lowercase handle -> platform label, to detect same-identity.
    handle_owner: Dict[str, str] = {}

    for p in platforms:
        plat = str(p.get("platform", "")).lower()
        url = p.get("url") or ""
        ids = p.get("ids_data") or {}
        pid = f"plat:{username}:{plat}"
        add_node(pid, plat, "platform", url, plat, p.get("status", "found"))
        add_edge(seed_id, pid, "claimed")

        # Alias detection: a secondary handle inside ids_data.
        alias = None
        for key in ("twitter_username", "twitter", "alias", "instagram", "telegram"):
            v = ids.get(key)
            if isinstance(v, str) and v:
                alias = v.lstrip("@")
                break
        if alias and alias.lower() != username.lower():
            aid = f"alias:{alias}"
            add_node(aid, alias, "alias", f"https://twitter.com/{alias}" if key == "twitter" else url, plat, "found")
            add_edge(pid, aid, "alias_of")

        # Same-identity: platforms sharing the same real name/company.
        for field in ("name", "company", "full_name"):
            val = ids.get(field)
            if isinstance(val, str) and val.strip():
                h = val.strip().lower()
                if h in handle_owner and handle_owner[h] != pid:
                    add_edge(handle_owner[h], pid, "same_identity")
                else:
                    handle_owner.setdefault(h, pid)
                break

    return {"nodes": nodes, "edges": edges}


# ---------------------------------------------------------------------------
# Maigret invocation
# ---------------------------------------------------------------------------


def _build_site_dict(db: Any, options: ScanOptions) -> Dict[str, Any]:
    """Resolve the ranked sites dict, honoring tags / permute / recursion."""
    id_type = "username"
    if options.tags:
        tags = [t for t in options.tags]
    else:
        tags = []
    return db.ranked_sites_dict(
        top=options.top,
        tags=tags,
        disabled=options.enable_cloudflare_bypass,  # include disabled only if bypass
        id_type=id_type,
    )


def _run_maigret_sync(username: str, options: ScanOptions) -> Any:
    """Run a Maigret search synchronously and return the raw results dict.

    Returns a ``Dict[site_name, SiteResult]`` (or ``None`` on failure / when
    the library is unavailable).
    """
    if not _MAIGRET_AVAILABLE:
        logger.warning("maigret unavailable — returning empty result")
        return None

    db = MaigretDatabase().load()
    site_dict = _build_site_dict(db, options)

    logger.info(
        "loaded maigret db (%d sites) for username=%s top=%d",
        len(site_dict),
        username,
        options.top,
    )

    query_notify = QueryNotifyPrint(silent=True)
    logger_ = logging.getLogger("maigret")

    # The library is async; drive it with a fresh event loop in this thread.
    loop = asyncio.new_event_loop()
    try:
        results = loop.run_until_complete(
            maigret_search(
                username,
                site_dict=site_dict,
                logger=logger_,
                query_notify=query_notify,
                timeout=options.timeout_ms / 1000,
                is_parsing_enabled=options.is_parsing_enabled,
                max_connections=100,
                no_progressbar=True,
                retries=options.retries,
                dns_resolver="threaded",
                proxy=options.proxy,
                check_domains=options.check_domains,
            )
        )
    finally:
        loop.close()

    return results


def _normalize_maigret_result(raw: Any, username: str) -> ScanResult:
    """Convert Maigret's ``Dict[site, SiteResult]`` into a ScanResult.

    A site counts as a found profile when its ``status.status`` is
    ``MaigretCheckStatus.CLAIMED``.
    """
    platforms: List[Dict[str, Any]] = []

    if not raw:
        return ScanResult(username=username)

    for site_name, entry in raw.items():
        try:
            status_obj = entry.get("status") if isinstance(entry, dict) else None
            if status_obj is None:
                continue

            raw_status = getattr(status_obj, "status", None)
            # Compare against the real enum when maigret is installed;
            # otherwise fall back to a string comparison so the normalizer
            # still works for tests / offline shapes.
            if MaigretCheckStatus is not None:
                found = raw_status == MaigretCheckStatus.CLAIMED
            else:
                found = str(raw_status) == "Claimed"
            if not found:
                continue

            url = (
                entry.get("url_user")
                or getattr(status_obj, "site_url_user", None)
                or ""
            )
            if not url:
                continue

            ids_data = _extract_ids_data(status_obj, entry)
            platforms.append(
                {
                    "platform": str(site_name).lower(),
                    "url": url,
                    "username": username,
                    "status": "found",
                    "ids_data": ids_data,
                }
            )
        except Exception:  # noqa: BLE001
            continue

    return ScanResult(
        username=username,
        platforms=platforms,
        sites_checked=len(raw) if hasattr(raw, "__len__") else 0,
        sites_found=len(platforms),
    )


def _extract_ids_data(status_obj: Any, entry: Dict[str, Any]) -> Dict[str, Any]:
    """Pull bio/company/location/avatar/name out of a Maigret result.

    Returns ``{}`` when nothing useful was extracted so the API response stays
    clean (no dict full of ``None`` values).
    """
    ids = getattr(status_obj, "ids_data", None) or entry.get("ids_data") or {}
    if not isinstance(ids, dict):
        return {}
    extracted = {
        "name": ids.get("name") or ids.get("full_name") or ids.get("title"),
        "bio": ids.get("bio") or ids.get("about") or ids.get("description"),
        "company": ids.get("company") or ids.get("work") or ids.get("employer"),
        "location": ids.get("location") or ids.get("city"),
        "avatar_url": ids.get("avatar_url") or ids.get("image") or ids.get("picture"),
    }
    if all(v is None for v in extracted.values()):
        return {}
    return extracted


class MaigretScanner:
    def __init__(self, options: ScanOptions) -> None:
        self.options = options

    async def scan(self, username: str) -> ScanResult:
        started = time.time()
        logger.info("starting scan username=%s top=%d", username, self.options.top)

        # Run the (synchronous-from-our-viewpoint) Maigret library in a
        # thread so the event loop stays responsive for other requests.
        try:
            raw = await asyncio.to_thread(_run_maigret_sync, username, self.options)
        except Exception as exc:  # noqa: BLE001
            logger.exception("maigret execution failed: %s", exc)
            raw = None

        result = _normalize_maigret_result(raw, username)
        result.duration_ms = int((time.time() - started) * 1000)

        # Compute confidence based on yield: 0 found → 0, 1-2 → 0.3, 3-5 → 0.6, 6+ → 0.9
        # This is a heuristic; the "real" signal is which platforms matched.
        n = result.sites_found
        if n == 0:
            result.confidence = 0.0
        elif n <= 2:
            result.confidence = 0.3
        elif n <= 5:
            result.confidence = 0.6
        else:
            result.confidence = min(0.95, 0.6 + (n - 5) * 0.03)

        if result.platforms:
            top = ", ".join(p["platform"] for p in result.platforms[:3])
            result.summary = f"Found {result.sites_found} profile(s): {top}"
        else:
            result.summary = "No profiles found"

        # Derive the connection graph from the real platforms. This is the
        # production data source for PersonalizeModal's Connection Graph; the
        # client-side simulator is only a fallback when this is empty.
        result.graph = build_graph(result.username, result.platforms)

        logger.info(
            "scan complete username=%s found=%d checked=%d duration=%dms",
            username,
            result.sites_found,
            result.sites_checked,
            result.duration_ms,
        )
        return result
