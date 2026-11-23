"""Bring-your-own-key (BYOK) support.

Provider API keys are supplied per request by the client (socket payload
``api_keys`` or the ``X-Provider-Keys`` JSON header) and held only in a
context variable for the duration of that request. Nothing is persisted or
logged. Server environment variables are used only when ALLOW_SERVER_KEYS=true.
"""
import contextvars
import json
import os
from typing import Optional

ALLOWED_KEYS = frozenset(
    {
        "VIDEO_DB_API_KEY",
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GOOGLEAI_API_KEY",
        "ELEVENLABS_API_KEY",
        "BEATOVEN_API_KEY",
        "STABILITYAI_API_KEY",
        "KLING_AI_ACCESS_API_KEY",
        "KLING_AI_SECRET_API_KEY",
        "FAL_KEY",
        "MUAPI_API_KEY",
        "REPLICATE_API_TOKEN",
        "SERP_API_KEY",
        "COMPOSIO_API_KEY",
        "SLACK_BOT_TOKEN",
    }
)

_request_keys: contextvars.ContextVar = contextvars.ContextVar(
    "provider_keys", default={}
)


def set_request_keys(keys) -> None:
    """Install the caller's keys for the current request (unknown names dropped)."""
    if isinstance(keys, str):
        try:
            keys = json.loads(keys)
        except ValueError:
            keys = {}
    if not isinstance(keys, dict):
        keys = {}
    _request_keys.set(
        {
            k: v.strip()
            for k, v in keys.items()
            if k in ALLOWED_KEYS and isinstance(v, str) and v.strip()
        }
    )


def get_key(name: str) -> Optional[str]:
    value = _request_keys.get().get(name)
    if value:
        return value
    if os.getenv("ALLOW_SERVER_KEYS", "").lower() == "true":
        return os.getenv(name) or None
    return None
