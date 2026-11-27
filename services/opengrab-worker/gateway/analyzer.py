from __future__ import annotations

import asyncio
from typing import Any, Protocol


class Analyzer(Protocol):
    async def analyze(self, url: str) -> dict[str, Any]: ...


def summarize(info: dict[str, Any]) -> dict[str, Any]:
    """Reduce a yt-dlp info dict to the fields the apps need. Pure function so it can be tested without a network."""
    formats = info.get("formats") or []
    heights = sorted({f["height"] for f in formats if f.get("height")}, reverse=True)
    # acodec "none" means video-only; a missing acodec means the site did not say, which is not the same as no audio.
    has_audio = not formats or any(f.get("acodec") != "none" for f in formats)
    is_playlist = info.get("_type") == "playlist"
    out: dict[str, Any] = {
        "title": info.get("title"),
        "description": (info.get("description") or "")[:2000] or None,
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "platform": info.get("extractor_key") or info.get("extractor"),
        "media_id": info.get("id"),
        "channel": info.get("channel") or info.get("uploader"),
        "webpage_url": info.get("webpage_url"),
        "heights": heights,
        "has_audio": has_audio,
        "is_live": bool(info.get("is_live")),
        "filesize_approx": info.get("filesize_approx") or info.get("filesize"),
        "subtitles": sorted((info.get("subtitles") or {}).keys()),
        "auto_captions": sorted((info.get("automatic_captions") or {}).keys()),
        "is_playlist": is_playlist,
        "media_type": "playlist" if is_playlist else ("video" if heights else "audio"),
    }
    if is_playlist:
        out["entries"] = [
            {"id": e.get("id"), "title": e.get("title"), "duration": e.get("duration"),
             "url": e.get("url") or e.get("webpage_url"), "thumbnail": e.get("thumbnail")}
            for e in (info.get("entries") or []) if e
        ][:200]
    return out


class YtDlpAnalyzer:
    """Metadata only (no download), with a fixed option set: customers cannot pass options, cookies or headers."""

    def __init__(self, timeout_s: int = 60, proxy: str | None = None) -> None:
        self._timeout = timeout_s
        self._proxy = proxy  # the egress proxy that re-validates every connection (not wired up yet)

    def _extract(self, url: str) -> dict[str, Any]:
        import yt_dlp  # imported lazily so unit tests do not need the engine

        opts: dict[str, Any] = {
            "quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True,
            "extract_flat": "in_playlist", "socket_timeout": 30, "extractor_retries": 2,
            "ignoreconfig": True, "no_color": True,
        }
        if self._proxy:
            opts["proxy"] = self._proxy
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(url, download=False) or {}

    async def analyze(self, url: str) -> dict[str, Any]:
        info = await asyncio.wait_for(asyncio.to_thread(self._extract, url), timeout=self._timeout)
        return summarize(info)
