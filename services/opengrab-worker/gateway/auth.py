from __future__ import annotations

import re
import secrets
from dataclasses import dataclass

from fastapi import HTTPException, Request

from .config import Settings

_USER_ID = re.compile(r"^[A-Za-z0-9_.:@-]{1,128}$")
_APP_ID = re.compile(r"^[a-z0-9_-]{1,32}$")


@dataclass(frozen=True)
class Caller:
    app_id: str
    user_id: str


def authenticate(request: Request, settings: Settings) -> Caller:
    """Server-to-server auth: Bearer <app secret> + X-App-Id + X-User-Id.

    The app (not the browser) vouches for the user. The secret is checked against the claimed app id only,
    so one app's secret never works for another app's id.
    """
    auth = request.headers.get("authorization", "")
    app_id = request.headers.get("x-app-id", "")
    user_id = request.headers.get("x-user-id", "")
    secret = settings.app_secrets.get(app_id) if _APP_ID.match(app_id) else None
    token = auth[7:] if auth.startswith("Bearer ") else ""
    # compare_digest on every path so a wrong app id and a wrong secret take the same time
    ok = secrets.compare_digest(token.encode(), (secret or "\0").encode()) and secret is not None
    if not ok:
        raise HTTPException(401, "unauthorized")
    if not _USER_ID.match(user_id):
        raise HTTPException(400, "invalid user id")
    return Caller(app_id=app_id, user_id=user_id)
