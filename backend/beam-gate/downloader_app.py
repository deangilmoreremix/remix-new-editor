"""Deploys the SmartVidDownloader pod (the upstream VidBee web app) to Beam as a new version of `smartvid-downloader`.

    beam deploy backend/beam-gate/downloader_app.py:pod        (run from the repository root)

The pod refuses every request that does not carry VIDBEE_GATE_TOKEN in the x-vidbee-gate header, so it is only usable through the gate
(backend/beam-gate/app.py), which holds the same secret. After a deploy this address changes: update the gate's VIDBEE_WEB_URL secret and
redeploy the gate. The 10Gi disk `smartvid-data` keeps downloads, history and settings across versions.
"""
from beam import DurableDisk, Image, Pod

pod = Pod(
    name="smartvid-downloader",
    image=Image.from_dockerfile("apps/vidbee/Dockerfile.beam", context_dir="apps/vidbee"),
    ports=[3000],
    entrypoint=["/app/start.sh"],
    cpu=2,
    memory="4Gi",
    disks=[DurableDisk(name="smartvid-data", size="10Gi", mount_path="/data", driver="snapshot")],
    secrets=["VIDBEE_GATE_TOKEN"],
    keep_warm_seconds=600,  # scales to zero when idle
    authorized=False,       # the pod does its own check: it only answers requests carrying the gate's secret
)
