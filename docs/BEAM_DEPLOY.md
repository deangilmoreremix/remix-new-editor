# Deploy VidBee on Beam (one container)

`apps/vidbee/Dockerfile.beam` builds the whole web edition as **one container with one public port (3000)**: the web server serves the pages and proxies to the API running privately inside the same container. Data lives on one persistent disk.

## 1. Deploy
Run from the `apps/vidbee` folder, with the Beam CLI installed and logged in:

```bash
beam secret create OPENAI_API_KEY
```

```bash
beam deploy --dockerfile Dockerfile.beam --name vidbee --port 3000 \
  --cpu 2 --memory 4Gi \
  --disk vidbee-data:/data:50Gi \
  --min-replicas 1 --max-replicas 1 \
  --secrets OPENAI_API_KEY
```

- `--disk … :/data` keeps downloads (`/data/downloads`) and the database and settings (`/data/vidbee`) across restarts. Beam allows one container per writable disk, which is what VidBee needs.
- `--min-replicas 1 --max-replicas 1`: exactly one always-on instance. Do not let it scale to zero or to two copies (SQLite, the task queue and live AI runs are in-process).
- `beam logs vidbee` shows startup. A healthy start ends with the web server listening on 3000.
- Add `authorized=True` (Python `Service.from_dockerfile(..., authorized=True)`) if you do not want the URL public; then the app backend must send Beam's token.

## 2. Check it
Open the deployed URL: the pages load. Then, in this order: add a download, transcribe it, run an AI prompt, export a video. Anything that fails shows in `beam logs vidbee`.

## 3. Connect the app
On the app backend set `VIDBEE_WEB_URL` to the Beam URL and `VIDBEE_ALLOWED_USERS` to the people allowed in. The web edition has no login of its own: keep the Beam URL private or behind this gate.

## What was and was not checked
- Checked: both apps build; laid out exactly as the image lays them out, `beam/start.sh` starts the API, waits for `/health`, starts the web server, and one port serves the pages, the API and the AI endpoints.
- **Not checked:** the image itself (no Docker daemon here), `beam deploy` (no Beam access here), real downloads in the container, and whether Beam cuts off long streams (`/stream`, `/export/video`). The Beam flags above come from Beam's documentation, not from a run.
