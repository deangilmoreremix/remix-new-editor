from __future__ import annotations

import asyncio
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class MediaError(Exception):
    """A file failed validation. `code` is a stable, user-safe reason."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def safe_filename(name: str | None, fallback: str = "media") -> str:
    """Basename only, no control characters or path separators, bounded length, extension kept."""
    name = unicodedata.normalize("NFKC", (name or "").replace("\\", "/").split("/")[-1])
    name = re.sub(r"[\x00-\x1f\x7f<>:\"|?*]", "", name).strip(" .")
    stem, dot, ext = name.rpartition(".")
    if not dot:
        stem, ext = name, ""
    ext = re.sub(r"[^A-Za-z0-9]", "", ext)[:8].lower()
    stem = re.sub(r"\s+", "_", stem).strip(" ._")[:120] or fallback
    return f"{stem}.{ext}" if ext else stem


def sniff_container(head: bytes) -> str | None:
    """Identify the container from its signature, ignoring the file name. HTML error pages and scripts return None."""
    if head[4:8] == b"ftyp":
        return "mp4"
    if head[:4] == b"\x1aE\xdf\xa3":
        return "matroska"
    if head[:4] == b"OggS":
        return "ogg"
    if head[:4] == b"RIFF" and head[8:12] in (b"WAVE", b"AVI "):
        return "riff"
    if head[:4] == b"fLaC":
        return "flac"
    if head[:3] == b"ID3" or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0):
        return "mp3"
    if head[:3] == b"FLV":
        return "flv"
    if head[:1] == b"\x47":  # MPEG-TS sync byte
        return "mpegts"
    return None


@dataclass(frozen=True)
class MediaInfo:
    container: str
    duration: float
    width: int | None
    height: int | None
    vcodec: str | None
    acodec: str | None
    size: int

    @property
    def has_video(self) -> bool:
        return self.vcodec is not None

    @property
    def has_audio(self) -> bool:
        return self.acodec is not None


async def _run(*args: str, timeout: float) -> tuple[int, bytes]:
    proc = await asyncio.create_subprocess_exec(*args, stdin=asyncio.subprocess.DEVNULL,
                                                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise MediaError("media_timeout") from None
    return proc.returncode or 0, out


async def probe(path: Path, timeout: float = 60) -> MediaInfo:
    with path.open("rb") as f:
        head = f.read(16)
    if sniff_container(head) is None:
        raise MediaError("not_media")
    code, out = await _run("ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams",
                           str(path), timeout=timeout)
    if code != 0:
        raise MediaError("media_corrupt")
    try:
        data: dict[str, Any] = json.loads(out)
    except ValueError:
        raise MediaError("media_corrupt") from None
    streams = data.get("streams") or []
    v = next((s for s in streams if s.get("codec_type") == "video"
              and not (s.get("disposition") or {}).get("attached_pic")), None)
    a = next((s for s in streams if s.get("codec_type") == "audio"), None)
    fmt = data.get("format") or {}
    try:
        duration = float(fmt.get("duration") or (v or a or {}).get("duration") or 0)
    except ValueError:
        duration = 0.0
    return MediaInfo(
        container=str(fmt.get("format_name") or ""), duration=duration,
        width=v.get("width") if v else None, height=v.get("height") if v else None,
        vcodec=v.get("codec_name") if v else None, acodec=a.get("codec_name") if a else None,
        size=path.stat().st_size,
    )


def check(kind: str, info: MediaInfo, *, max_bytes: int, clip_seconds: float | None = None) -> None:
    """Raise MediaError unless the file matches what was asked for."""
    if info.size <= 0:
        raise MediaError("media_empty")
    if info.size > max_bytes:
        raise MediaError("file_too_large")
    if info.duration <= 0:
        raise MediaError("media_corrupt")
    if kind == "audio":
        if not info.has_audio:
            raise MediaError("no_audio_stream")
    elif not info.has_video:
        raise MediaError("no_video_stream")
    if clip_seconds:
        if abs(info.duration - clip_seconds) > max(3.0, clip_seconds * 0.1):
            raise MediaError("clip_length_mismatch")


def needs_conversion(kind: str, info: MediaInfo) -> bool:
    """Editor-compatible means H.264 + AAC in MP4 (video) or MP3 (audio). Anything already compatible is left alone."""
    if kind == "audio":
        return info.acodec != "mp3" or "mp3" not in info.container
    in_mp4 = "mp4" in info.container or "mov" in info.container
    return not (in_mp4 and info.vcodec == "h264" and info.acodec in (None, "aac"))


async def convert(src: Path, dst: Path, kind: str, info: MediaInfo, timeout: float = 1800) -> None:
    """Fixed ffmpeg argument lists only: nothing from a customer is ever placed on this command line.
    Streams that are already compatible are copied, not re-encoded."""
    base = ["ffmpeg", "-nostdin", "-y", "-v", "error", "-i", str(src)]
    if kind == "audio":
        args = base + ["-vn", "-map", "0:a:0", "-c:a", "libmp3lame", "-b:a", "192k", "-f", "mp3", str(dst)]
    else:
        v = ["-c:v", "copy"] if info.vcodec == "h264" else ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                                                              "-pix_fmt", "yuv420p"]
        a = ["-c:a", "copy"] if info.acodec == "aac" else ["-c:a", "aac", "-b:a", "160k"]
        maps = ["-map", "0:v:0"] + (["-map", "0:a:0"] if info.has_audio else [])
        args = base + maps + v + (a if info.has_audio else ["-an"]) + ["-movflags", "+faststart", "-f", "mp4", str(dst)]
    code, _ = await _run(*args, timeout=timeout)
    if code != 0 or not dst.exists() or dst.stat().st_size == 0:
        raise MediaError("convert_failed")
