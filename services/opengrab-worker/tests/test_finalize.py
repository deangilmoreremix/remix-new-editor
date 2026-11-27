from __future__ import annotations

import asyncio
import shutil
import subprocess
from pathlib import Path
from typing import Any

import httpx
import pytest

from gateway import media
from gateway.app import create_app
from gateway.blobs import MemoryBlobs
from gateway.config import Settings
from gateway.finalize import Finalizer
from gateway.store import MemoryStore

from .test_gateway import FakeAnalyzer, FakeUpstream, PUBLIC, h

pytestmark = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg/ffprobe not installed")
SETTINGS = dict(app_secrets={"remix": "sa", "ohb": "sb"}, poll_interval_s=0)


def ff(out: Path, *args: str) -> Path:
    subprocess.run(["ffmpeg", "-nostdin", "-y", "-v", "error", *args, str(out)], check=True)
    return out


@pytest.fixture(scope="module")
def files(tmp_path_factory) -> dict[str, Path]:
    d = tmp_path_factory.mktemp("media")
    v = ["-f", "lavfi", "-i", "testsrc=d=2:s=160x120:r=15"]
    a = ["-f", "lavfi", "-i", "sine=d=2"]
    out = {
        "h264_aac_mp4": ff(d / "ok.mp4", *v, *a, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest"),
        "mpeg4_mp3_mkv": ff(d / "old.mkv", *v, *a, "-c:v", "mpeg4", "-c:a", "libmp3lame", "-shortest"),
        "aac_m4a": ff(d / "song.m4a", *a, "-c:a", "aac"),
        "mp3": ff(d / "song.mp3", *a, "-c:a", "libmp3lame"),
    }
    out["html"] = d / "error.html"
    out["html"].write_text("<html><body>Sign in to confirm</body></html>")
    out["corrupt"] = d / "bad.mp4"
    out["corrupt"].write_bytes(b"\x00\x00\x00\x18ftypmp42" + b"\xff" * 4000)
    return out


class FileUpstream(FakeUpstream):
    """Serves a chosen local file as the engine's finished download."""

    def __init__(self, path: Path | None = None, name: str = "Some Title.mp4") -> None:
        super().__init__()
        self.path, self.name, self.discarded = path, name, []

    async def download_file(self, upstream_id, dest, max_bytes) -> str:
        assert self.path is not None
        if self.path.stat().st_size > max_bytes:
            raise media.MediaError("file_too_large")
        shutil.copy(self.path, dest)
        return self.name

    async def discard(self, upstream_id) -> None:
        self.discarded.append(upstream_id)


async def finalize(tmp_path, file: Path, kind="video", name="Some Title.mp4", options=None, **settings):
    s = Settings(**{**SETTINGS, "scratch_dir": str(tmp_path / "scratch"), **settings})
    store, blobs, up = MemoryStore(), MemoryBlobs(), FileUpstream(file, name)
    row = await store.create({"app_id": "remix", "user_id": "u1", "upstream_job_id": "e1", "kind": kind,
                              "source_url": "https://vimeo.com/1", "options": options or {}, "status": "uploading",
                              "stage": "fetching"})
    await Finalizer(s, store, up, blobs).run(row)
    return (await store.get("remix", "u1", row["id"])), blobs, up, tmp_path / "scratch"


async def test_compatible_video_is_stored_unchanged(tmp_path, files):
    row, blobs, up, scratch = await finalize(tmp_path, files["h264_aac_mp4"])
    assert row["status"] == "done" and row["error"] is None
    assert (row["vcodec"], row["acodec"], row["width"], row["height"]) == ("h264", "aac", 160, 120)
    assert 1.5 < row["duration_s"] < 2.6 and row["size_bytes"] == files["h264_aac_mp4"].stat().st_size
    (path,) = blobs.objects
    assert path == f"remix/u1/{row['id']}/Some_Title.mp4" and row["storage_path"] == path
    assert blobs.objects[path][1] == "video/mp4"
    assert blobs.objects[path][0] == files["h264_aac_mp4"].read_bytes()  # not re-encoded
    assert not (scratch / row["id"]).exists() and up.discarded == ["e1"]


async def test_incompatible_video_is_converted_to_h264_aac_mp4(tmp_path, files):
    row, blobs, *_ = await finalize(tmp_path, files["mpeg4_mp3_mkv"], name="old.mkv")
    assert row["status"] == "done" and row["storage_path"].endswith("/old.mp4")
    assert (row["vcodec"], row["acodec"]) == ("h264", "aac")
    stored = tmp_path / "check.mp4"
    stored.write_bytes(blobs.objects[row["storage_path"]][0])
    info = await media.probe(stored)
    assert "mp4" in info.container and info.vcodec == "h264" and info.acodec == "aac"


async def test_audio_is_delivered_as_mp3(tmp_path, files):
    row, blobs, *_ = await finalize(tmp_path, files["aac_m4a"], kind="audio", name="song.m4a")
    assert row["status"] == "done" and row["storage_path"].endswith("/song.mp3") and row["acodec"] == "mp3"
    assert row["vcodec"] is None and blobs.objects[row["storage_path"]][1] == "audio/mpeg"
    row2, blobs2, *_ = await finalize(tmp_path, files["mp3"], kind="audio", name="song.mp3")
    assert row2["status"] == "done" and blobs2.objects[row2["storage_path"]][0] == files["mp3"].read_bytes()


@pytest.mark.parametrize("key,kind,code", [
    ("html", "video", "not_media"),
    ("corrupt", "video", "media_corrupt"),
    ("aac_m4a", "video", "no_video_stream"),
])
async def test_bad_files_fail_with_a_stable_code_and_store_nothing(tmp_path, files, key, kind, code):
    row, blobs, up, scratch = await finalize(tmp_path, files[key], kind=kind)
    assert row["status"] == "failed" and row["error"] == code and row.get("storage_path") is None
    assert blobs.objects == {} and not (scratch / row["id"]).exists() and up.discarded == ["e1"]


async def test_size_cap_is_enforced_while_fetching(tmp_path, files):
    big = tmp_path / "big.mp4"
    big.write_bytes(files["h264_aac_mp4"].read_bytes() + b"\0" * (2 * 1024 * 1024))
    row, blobs, *_ = await finalize(tmp_path, big, max_file_mb=1)
    assert row["status"] == "failed" and row["error"] == "file_too_large" and blobs.objects == {}


async def test_clip_length_must_match_the_request(tmp_path, files):
    ok, *_ = await finalize(tmp_path, files["h264_aac_mp4"], kind="clip", options={"clip_start": 10, "clip_end": 12})
    assert ok["status"] == "done"
    bad, *_ = await finalize(tmp_path, files["h264_aac_mp4"], kind="clip", options={"clip_start": 0, "clip_end": 60})
    assert bad["status"] == "failed" and bad["error"] == "clip_length_mismatch"


async def test_storage_outage_fails_the_job_without_leaking_details(tmp_path, files):
    class Down(MemoryBlobs):
        async def upload(self, *a, **k):
            raise httpx.ConnectError("secret-host.internal refused")

    s = Settings(**{**SETTINGS, "scratch_dir": str(tmp_path / "s")})
    store, up = MemoryStore(), FileUpstream(files["h264_aac_mp4"])
    row = await store.create({"app_id": "remix", "user_id": "u1", "upstream_job_id": "e1", "kind": "video",
                              "source_url": "x", "options": {}, "status": "uploading"})
    await Finalizer(s, store, up, Down()).run(row)
    got = await store.get("remix", "u1", row["id"])
    assert got["status"] == "failed" and got["error"] == "storage_unavailable"


# --- through the app: the whole lifecycle ----------------------------------------------------------------------
def build(tmp_path, file: Path, **extra):
    s = Settings(**{**SETTINGS, "scratch_dir": str(tmp_path / "scratch"), **extra})
    store, blobs, up = MemoryStore(), MemoryBlobs(), FileUpstream(file)
    app = create_app(s, store, up, FakeAnalyzer(), resolver=PUBLIC, blobs=blobs)
    client = httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://worker")
    return app, client, store, blobs, up


async def test_full_lifecycle_to_signed_url_and_delete(tmp_path, files):
    app, c, store, blobs, up = build(tmp_path, files["h264_aac_mp4"])
    jid = (await c.post("/v1/jobs", json={"url": "https://vimeo.com/1"}, headers=h())).json()["id"]

    up.jobs["u1"].update(status="done", percent=100)
    j = (await c.get(f"/v1/jobs/{jid}", headers=h())).json()
    assert j["status"] == "uploading"  # engine done is not final
    assert (await c.get(f"/v1/jobs/{jid}/download-url", headers=h())).status_code == 409
    await asyncio.gather(*app.state.finalize_tasks)

    j = (await c.get(f"/v1/jobs/{jid}", headers=h())).json()
    assert j["status"] == "done" and j["vcodec"] == "h264" and "storage_path" not in j
    r = (await c.get(f"/v1/jobs/{jid}/download-url", headers=h())).json()
    assert r["url"].startswith("https://storage.test/") and r["expires_in"] == 900
    # other user / other app: no URL, no delete
    for who in (h("remix", "bob"), h("ohb", "u1")):
        assert (await c.get(f"/v1/jobs/{jid}/download-url", headers=who)).status_code == 404
        assert (await c.delete(f"/v1/jobs/{jid}", headers=who)).status_code == 404
    assert len(blobs.objects) == 1
    assert (await c.delete(f"/v1/jobs/{jid}", headers=h())).status_code == 204
    assert blobs.objects == {} and (await c.get(f"/v1/jobs/{jid}", headers=h())).status_code == 404


async def test_concurrent_refreshes_finalize_only_once(tmp_path, files):
    app, c, store, blobs, up = build(tmp_path, files["h264_aac_mp4"])
    jid = (await c.post("/v1/jobs", json={"url": "https://vimeo.com/1"}, headers=h())).json()["id"]
    up.jobs["u1"].update(status="done", percent=100)
    uploads = []
    orig = blobs.upload

    async def counting(*a, **k):
        uploads.append(a[0])
        await orig(*a, **k)

    blobs.upload = counting  # type: ignore[method-assign]
    await asyncio.gather(*[c.get(f"/v1/jobs/{jid}", headers=h()) for _ in range(8)])
    await asyncio.gather(*app.state.finalize_tasks)
    assert len(uploads) == 1 and up.discarded == ["u1"]


async def test_restart_recovery(tmp_path, files):
    app, c, store, blobs, up = build(tmp_path, files["h264_aac_mp4"])
    base = {"app_id": "remix", "user_id": "u1", "kind": "video", "source_url": "x", "options": {}}
    lost = await store.create({**base, "status": "uploading", "upstream_job_id": "gone"})
    kept = await store.create({**base, "status": "uploading", "upstream_job_id": "u9"})
    up.jobs["u9"] = {"id": "u9", "status": "done"}
    async with app.router.lifespan_context(app):
        pass
    assert (await store.get("remix", "u1", lost["id"]))["error"] == "worker_restarted"
    got = await store.get("remix", "u1", kept["id"])
    assert (got["status"], got["stage"]) == ("processing", "finalizing")


# --- helpers ----------------------------------------------------------------------------------------------------
@pytest.mark.parametrize("raw,expected", [
    ("../../etc/passwd", "passwd"), ("a\\b\\c.mp4", "c.mp4"), ("na\x00me\n.MP4", "name.mp4"),
    ("", "media"), (None, "media"), ("...", "media"), ("x" * 300 + ".mp4", "x" * 120 + ".mp4"),
    ("clip: \"best\" <of> | 2026?.mp4", "clip_best_of_2026.mp4"),
])
def test_safe_filename(raw, expected):
    assert media.safe_filename(raw) == expected


def test_sniff_rejects_non_media():
    assert media.sniff_container(b"<html><head>") is None and media.sniff_container(b"#!/bin/sh\nrm") is None
    assert media.sniff_container(b"\x00\x00\x00\x18ftypmp42") == "mp4" and media.sniff_container(b"ID3\x04") == "mp3"


async def test_storage_413_is_reported_as_file_too_large(tmp_path, files):
    class Limit(MemoryBlobs):
        async def upload(self, *a, **k):
            req = httpx.Request("POST", "https://x/storage/v1/object/b/p")
            raise httpx.HTTPStatusError("413", request=req, response=httpx.Response(413, request=req))

    s = Settings(**{**SETTINGS, "scratch_dir": str(tmp_path / "s")})
    store = MemoryStore()
    row = await store.create({"app_id": "remix", "user_id": "u1", "upstream_job_id": "e1", "kind": "video",
                              "source_url": "x", "options": {}, "status": "uploading"})
    await Finalizer(s, store, FileUpstream(files["h264_aac_mp4"]), Limit()).run(row)
    got = await store.get("remix", "u1", row["id"])
    assert got["status"] == "failed" and got["error"] == "file_too_large"


async def test_signed_url_is_percent_encoded():
    import json

    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["path"] = req.url.path
        return httpx.Response(200, json={"signedURL": "/object/sign/media-downloads/remix/u1/j/Big Buck Bunny.mp4?token=abc"})

    from gateway.blobs import SupabaseBlobs
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    url = await SupabaseBlobs("https://x.supabase.co", "k", "media-downloads", client).sign("remix/u1/j/a b.mp4", 60)
    assert " " not in url and url.endswith("Big%20Buck%20Bunny.mp4?token=abc") and "/storage/v1/object/sign/" in url
