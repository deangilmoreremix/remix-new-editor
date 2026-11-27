from __future__ import annotations

import os
from dataclasses import dataclass, field

QUALITIES = ("best", "1080p", "720p", "480p", "audio")


def _int(name: str, default: int) -> int:
    try:
        return max(0, int(os.environ.get(name, default)))
    except ValueError:
        return default


def _parse_secrets(raw: str) -> dict[str, str]:
    """'remix:secretA,ohb:secretB' -> {'remix': 'secretA', 'ohb': 'secretB'}. Empty secrets are dropped."""
    out: dict[str, str] = {}
    for part in raw.split(","):
        app_id, _, secret = part.strip().partition(":")
        if app_id and secret:
            out[app_id] = secret
    return out


@dataclass(frozen=True)
class Settings:
    app_secrets: dict[str, str] = field(default_factory=dict)  # app id -> server-to-server secret
    upstream_url: str = "http://127.0.0.1:8800"
    upstream_token: str = ""
    max_duration_s: int = 3600  # 60 min
    max_height: int = 1080
    max_file_mb: int = 2048
    max_batch: int = 10
    user_active_jobs: int = 2
    global_active_jobs: int = 5
    analyze_timeout_s: int = 60
    scratch_dir: str = "/data/scratch"
    storage_bucket: str = "media-downloads"
    signed_url_ttl_s: int = 900
    poll_interval_s: float = 2.0  # 0 turns the background poller off (tests)

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            app_secrets=_parse_secrets(os.environ.get("WORKER_APP_SECRETS", "")),
            upstream_url=os.environ.get("UPSTREAM_URL", "http://127.0.0.1:8800").rstrip("/"),
            upstream_token=os.environ.get("UPSTREAM_TOKEN", ""),
            max_duration_s=_int("MAX_DURATION_S", 3600),
            max_height=_int("MAX_HEIGHT", 1080),
            max_file_mb=_int("MAX_FILE_MB", 2048),
            max_batch=_int("MAX_BATCH", 10),
            user_active_jobs=_int("USER_ACTIVE_JOBS", 2),
            global_active_jobs=_int("GLOBAL_ACTIVE_JOBS", 5),
            analyze_timeout_s=_int("ANALYZE_TIMEOUT_S", 60),
            scratch_dir=os.environ.get("SCRATCH_DIR", "/data/scratch"),
            storage_bucket=os.environ.get("STORAGE_BUCKET", "media-downloads"),
            signed_url_ttl_s=_int("SIGNED_URL_TTL_S", 900),
            poll_interval_s=float(os.environ.get("POLL_INTERVAL_S", 2)),
        )
