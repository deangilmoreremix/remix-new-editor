"""Deploys the SmartVidDownloader gate (sign-in check + proxy to the downloader pod) as a small Beam Pod.

    beam deploy backend/beam-gate/app.py:pod        (run from the repository root)

Secrets must exist first; see README.md.
"""
from beam import Image, Pod

SECRETS = [
    "VIDBEE_GATE_TOKEN",       # shared with the downloader pod; the pod refuses requests that do not carry it
    "VIDBEE_SESSION_SECRET",   # signs the 8-hour session cookie
    "VIDBEE_WEB_URL",          # the downloader pod's address (changes with every deploy of the pod)
    "VIDBEE_ALLOWED_USERS",    # comma-separated user ids or emails allowed in; empty means nobody
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",       # the public (publishable) key, as shipped in the web app
]

pod = Pod(
    name="smartvid-vidbee-gate",
    image=Image.from_dockerfile("backend/beam-gate/Dockerfile", context_dir="."),
    ports=[8080],
    entrypoint=["node", "/app/gate-server.mjs"],
    cpu=1,
    memory=1024,
    secrets=SECRETS,
    env={"NODE_ENV": "production", "PORT": "8080", "VIDBEE_PER_USER": "1"},  # also set on the downloader pod: private library per person
    keep_warm_seconds=600,  # scales to zero when idle, like the other Pods
    authorized=False,       # the browser reaches it through smartvid.app; the gate does its own sign-in check
)
