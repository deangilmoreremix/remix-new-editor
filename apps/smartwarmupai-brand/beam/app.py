"""Deploys the SmartWarmupAI backend (Postgres, Redis, NATS and the Go API in one container) as a Beam Pod.

    beam deploy apps/smartwarmupai-brand/beam/app.py:pod        (run from the repository root)

Secrets must exist first; see README.md. Every name below is taken from Beam's Pod and DurableDisk docs.
"""
from beam import DurableDisk, Image, Pod

SECRETS = ["KMS_LOCAL_MASTER_KEY", "CREDENTIALS_ENCRYPTION_KEY", "AUTH_SECRET", "PORTAL_EDGE_TOKEN", "INTERNAL_API_TOKEN", "STUDIO_ORIGINS", "APP_URL", "CLERK_ISSUER", "CLERK_SECRET_KEY", "CLERK_AUTHORIZED_PARTIES"]

pod = Pod(
    name="smartwarmupai-backend",
    image=Image.from_dockerfile("apps/smartwarmupai-brand/beam/Dockerfile", context_dir="."),
    ports=[8080],
    entrypoint=["tini", "--", "/app/entrypoint.sh"],
    cpu=2,
    memory="4Gi",
    disks=[DurableDisk(name="smartwarmupai-data", size="20Gi", mount_path="/data")],
    secrets=SECRETS,
    keep_warm_seconds=600,  # scales to zero after 10 idle minutes (Beam's default for Pods)
    authorized=False,  # the dashboard calls the API from the browser, so the URL must be public; the API has its own auth
)
