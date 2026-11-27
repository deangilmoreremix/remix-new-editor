from __future__ import annotations

from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from gateway.analyzer import summarize
from gateway.app import create_app
from gateway.config import Settings
from gateway.store import MemoryStore
from gateway.urlcheck import UrlRejected, validate_public_url

PUBLIC = lambda host: ["93.184.216.34"]  # noqa: E731


class FakeAnalyzer:
    def __init__(self, **info: Any) -> None:
        self.info = {"title": "T", "duration": 120, "platform": "Vimeo", "media_id": "m1",
                     "webpage_url": "https://vimeo.com/1", "is_live": False, "is_playlist": False, **info}
        self.calls: list[str] = []

    async def analyze(self, url: str) -> dict[str, Any]:
        self.calls.append(url)
        return dict(self.info)


class FakeUpstream:
    def __init__(self) -> None:
        self.created: list[tuple] = []
        self.cancelled: list[str] = []
        self.jobs: dict[str, dict[str, Any]] = {}
        self.fail = False

    async def create_job(self, url, quality, clip_start, clip_end, subs, thumb) -> str:
        if self.fail:
            raise httpx.ConnectError("down")
        uid = f"u{len(self.created) + 1}"
        self.created.append((url, quality, clip_start, clip_end))
        self.jobs[uid] = {"id": uid, "status": "downloading", "percent": 10}
        return uid

    async def get_job(self, upstream_id):
        return self.jobs.get(upstream_id)

    async def cancel(self, upstream_id) -> None:
        self.cancelled.append(upstream_id)


def make(settings: Settings | None = None, analyzer: FakeAnalyzer | None = None):
    s = settings or Settings(app_secrets={"remix": "sa", "ohb": "sb"})
    store, up = MemoryStore(), FakeUpstream()
    client = TestClient(create_app(s, store, up, analyzer or FakeAnalyzer(), resolver=PUBLIC))
    return client, store, up


def h(app="remix", user="u1", secret=None):
    sec = secret if secret is not None else {"remix": "sa", "ohb": "sb"}[app]
    return {"Authorization": f"Bearer {sec}", "X-App-Id": app, "X-User-Id": user}


URL = {"url": "https://vimeo.com/1"}


# --- auth -------------------------------------------------------------------
def test_health_is_public_everything_else_needs_auth():
    c, *_ = make()
    assert c.get("/health").status_code == 200
    assert c.post("/v1/analyze", json=URL).status_code == 401
    assert c.get("/v1/jobs").status_code == 401


def test_secret_must_match_the_claimed_app():
    c, *_ = make()
    assert c.post("/v1/analyze", json=URL, headers=h("remix", secret="sb")).status_code == 401
    assert c.post("/v1/analyze", json=URL, headers=h("ohb", secret="sa")).status_code == 401
    assert c.post("/v1/analyze", json=URL, headers=h("remix")).status_code == 200


def test_unknown_app_and_bad_user_id_rejected():
    c, *_ = make()
    assert c.post("/v1/analyze", json=URL, headers={**h(), "X-App-Id": "nope"}).status_code == 401
    assert c.post("/v1/analyze", json=URL, headers={**h(), "X-User-Id": "a b;"}).status_code == 400


def test_no_configured_secrets_means_nothing_is_allowed():
    c, *_ = make(Settings())
    assert c.post("/v1/analyze", json=URL, headers=h("remix", secret="")).status_code == 401


# --- url validation ---------------------------------------------------------
@pytest.mark.parametrize("url", [
    "ftp://x.com/a", "file:///etc/passwd", "http://localhost/a", "http://127.0.0.1/a", "http://10.0.0.5/a",
    "http://169.254.169.254/latest/meta-data", "http://[::1]/a", "http://[::ffff:10.0.0.5]/a",
    "http://100.64.0.1/a", "http://user:pw@example.com/a", "https://example.com:22/a",
    "http://metadata.google.internal/a", "http://printer.local/a", "https://exa mple.com", "",
])
def test_rejects_unsafe_urls(url):
    with pytest.raises(UrlRejected):
        validate_public_url(url, PUBLIC)


def test_rejects_hostname_that_resolves_to_a_private_address():
    with pytest.raises(UrlRejected) as e:
        validate_public_url("https://evil.example/a", lambda h: ["93.184.216.34", "10.0.0.7"])
    assert e.value.code == "url_internal"


def test_canonicalises_and_strips_fragment():
    assert validate_public_url("HTTPS://Vimeo.com:443/1?a=b#frag", PUBLIC) == "https://vimeo.com/1?a=b"


def test_api_rejects_private_url():
    c, *_ = make()
    r = c.post("/v1/analyze", json={"url": "http://169.254.169.254/"}, headers=h())
    assert r.status_code == 400 and r.json() == {"error": "url_internal"}


# --- analyze / limits -------------------------------------------------------
def test_analyze_flags_over_duration():
    c, *_ = make(analyzer=FakeAnalyzer(duration=7200))
    assert c.post("/v1/analyze", json=URL, headers=h()).json()["exceeds_limits"] is True


def test_job_over_duration_rejected_but_short_clip_of_long_video_allowed():
    c, store, up = make(analyzer=FakeAnalyzer(duration=7200))
    assert c.post("/v1/jobs", json=URL, headers=h()).json() == {"error": "duration_limit"}
    r = c.post("/v1/jobs", json={**URL, "clip_start": 10, "clip_end": 70}, headers=h())
    assert r.status_code == 201 and r.json()["kind"] == "clip"


def test_live_and_playlist_rejected():
    c, *_ = make(analyzer=FakeAnalyzer(is_live=True))
    assert c.post("/v1/jobs", json=URL, headers=h()).json() == {"error": "live_not_supported"}
    c, *_ = make(analyzer=FakeAnalyzer(is_playlist=True))
    assert c.post("/v1/jobs", json=URL, headers=h()).json() == {"error": "playlist_requires_selection"}


def test_best_is_capped_to_1080p_and_higher_presets_rejected():
    c, _, up = make()
    assert c.post("/v1/jobs", json=URL, headers=h()).status_code == 201
    assert up.created[0][1] == "1080p"
    assert c.post("/v1/jobs", json={**URL, "quality": "4k"}, headers=h()).json() == {"error": "quality_invalid"}


def test_clip_validation():
    c, *_ = make()
    assert c.post("/v1/jobs", json={**URL, "clip_start": 5}, headers=h()).json() == {"error": "clip_incomplete"}
    r = c.post("/v1/jobs", json={**URL, "clip_start": 5, "clip_end": 5.5}, headers=h())
    assert r.json() == {"error": "clip_invalid_range"}


def test_per_user_and_global_concurrency_limits():
    s = Settings(app_secrets={"remix": "sa", "ohb": "sb"}, user_active_jobs=2, global_active_jobs=3)
    c, *_ = make(s)
    for _ in range(2):
        assert c.post("/v1/jobs", json=URL, headers=h(user="a")).status_code == 201
    assert c.post("/v1/jobs", json=URL, headers=h(user="a")).json() == {"error": "user_job_limit"}
    assert c.post("/v1/jobs", json=URL, headers=h(user="b")).status_code == 201
    assert c.post("/v1/jobs", json=URL, headers=h(user="c")).json() == {"error": "global_job_limit"}


# --- ownership --------------------------------------------------------------
def test_other_users_and_other_apps_cannot_see_or_cancel_a_job():
    c, store, up = make()
    jid = c.post("/v1/jobs", json=URL, headers=h("remix", "alice")).json()["id"]
    assert c.get(f"/v1/jobs/{jid}", headers=h("remix", "alice")).status_code == 200
    for who in (h("remix", "bob"), h("ohb", "alice")):
        assert c.get(f"/v1/jobs/{jid}", headers=who).status_code == 404
        assert c.post(f"/v1/jobs/{jid}/cancel", headers=who).status_code == 404
        assert c.get("/v1/jobs", headers=who).json() == []
    assert up.cancelled == []


def test_public_job_does_not_leak_internal_fields():
    c, *_ = make()
    body = c.post("/v1/jobs", json=URL, headers=h()).json()
    assert not {"upstream_job_id", "app_id", "user_id", "storage_path"} & set(body)


# --- lifecycle --------------------------------------------------------------
def test_progress_is_mirrored_and_upstream_done_is_not_final():
    c, store, up = make()
    jid = c.post("/v1/jobs", json=URL, headers=h()).json()["id"]
    up.jobs["u1"].update(status="downloading", percent=42.0, speed="1MiB/s")
    j = c.get(f"/v1/jobs/{jid}", headers=h()).json()
    assert j["status"] == "downloading" and j["percent"] == 42.0
    up.jobs["u1"].update(status="done", percent=100)
    j = c.get(f"/v1/jobs/{jid}", headers=h()).json()
    assert j["status"] == "processing" and j["stage"] == "finalizing"  # not 'done' until validated + uploaded


def test_engine_error_text_is_not_passed_through():
    c, _, up = make()
    jid = c.post("/v1/jobs", json=URL, headers=h()).json()["id"]
    up.jobs["u1"].update(status="error", error="HTTP 403 for https://secret.example/?token=abc")
    j = c.get(f"/v1/jobs/{jid}", headers=h()).json()
    assert j["status"] == "failed" and j["error"] == "download_failed"


def test_cancel_and_worker_down():
    c, store, up = make()
    jid = c.post("/v1/jobs", json=URL, headers=h()).json()["id"]
    assert c.post(f"/v1/jobs/{jid}/cancel", headers=h()).json()["status"] == "cancelled"
    assert up.cancelled == ["u1"]
    up.fail = True
    r = c.post("/v1/jobs", json=URL, headers=h())
    assert r.status_code == 503 and r.json() == {"error": "worker_unavailable"}
    assert [x["status"] for x in store.rows.values()].count("failed") == 1


# --- analyzer summary -------------------------------------------------------
def test_summarize_maps_fields_and_playlists():
    info = {"title": "x", "id": "abc", "extractor_key": "Vimeo", "duration": 10, "uploader": "me",
            "formats": [{"height": 720, "acodec": "aac"}, {"height": 1080, "acodec": "none"}, {"height": None}],
            "subtitles": {"en": []}, "automatic_captions": {"fr": []}}
    s = summarize(info)
    assert s["heights"] == [1080, 720] and s["subtitles"] == ["en"] and s["auto_captions"] == ["fr"]
    assert s["media_type"] == "video" and s["platform"] == "Vimeo" and s["channel"] == "me"
    p = summarize({"_type": "playlist", "entries": [{"id": "1", "title": "a", "url": "u"}, None]})
    assert p["is_playlist"] and p["entries"] == [
        {"id": "1", "title": "a", "duration": None, "url": "u", "thumbnail": None}]
