# Deploy VidBee on Beam (one container)

`apps/vidbee/Dockerfile.beam` builds the whole web edition as **one container with one public port (3000)**: the web server serves the pages and proxies to the API running privately inside the same container. Data lives on one persistent disk.

## 0. One-time Beam setup (from Beam's docs)
1. Install the CLI (needs Python 3):

```bash
python3 -m venv .venv && source .venv/bin/activate && python -m pip install --upgrade beam-client
```

2. Log in. This opens your browser to sign in or create a Beam account (on a server with no browser use `beam login --browserless`). Dashboard: https://platform.beam.cloud

```bash
beam login
```

3. Check it worked:

```bash
beam whoami
```

## 1. Deploy
Run from the `apps/vidbee` folder. First store your OpenAI key as a Beam secret (replace `sk-...` with your key; you can also add it in the dashboard under Settings, Secrets):

```bash
# Not needed: this is a bring-your-own-key app. Visitors enter their own OpenAI key in the app.
```

```bash
beam deploy --dockerfile Dockerfile.beam --name vidbee --port 3000 \
  --cpu 1 --memory 2Gi \
  --disk vidbee-data:/data:20Gi \
  --scale-to-zero --min-replicas 0 --max-replicas 1 \
  --keep-warm-seconds 300
```

- `--disk … :/data` keeps downloads (`/data/downloads`) and the database and settings (`/data/vidbee`) across restarts. Beam allows one container per writable disk, which is what VidBee needs.
- **Cost: it only runs while people use it.** `--scale-to-zero --min-replicas 0` lets it stop 5 minutes (`--keep-warm-seconds 300`) after the last request, so you pay only for active time. Never use `--always-on` or `--min-replicas 1` unless you want it billed 24/7. `--max-replicas 1`: never two copies at once (SQLite, the task queue and live AI runs are in-process). The first visit after idle takes a few seconds longer while it starts. Check `beam container list` is empty when nobody is using it.
- **The URL:** `beam deploy` prints the deployed URL when it finishes (Beam's docs say "open the URL printed by the command"). It is not known in advance. `beam deployment list` shows your deployments.
- `beam logs vidbee` shows startup. A healthy start ends with the web server listening on 3000.
- Add `authorized=True` (Python `Service.from_dockerfile(..., authorized=True)`) if you do not want the URL public; then the app backend must send Beam's token.

## 2. Check it
Open the deployed URL: the pages load. Then, in this order: add a download, transcribe it, run an AI prompt, export a video. Anything that fails shows in `beam logs vidbee`.

## Colours (one deployment, three looks)
The page picks its palette from the address: `?brand=remix` (neon green, this repo's palette), `?brand=higgs` (cyan, the OpenHiggsBolt palette), or nothing for upstream VidBee's own amber. The choice is remembered in the browser. Light and dark follow *Settings, Theme* (System, Light or Dark). Each app embeds the URL with its own `brand`.

## 3. Connect the app
On the app backend set `VIDBEE_WEB_URL` to the Beam URL and `VIDBEE_ALLOWED_USERS` to the people allowed in. The web edition has no login of its own: keep the Beam URL private or behind this gate.

## What was and was not checked
- Checked: both apps build; laid out exactly as the image lays them out, `beam/start.sh` starts the API, waits for `/health`, starts the web server, and one port serves the pages, the API and the AI endpoints.
- **Not checked:** the image itself (no Docker daemon here), `beam deploy` (no Beam access here), real downloads in the container, and whether Beam cuts off long streams (`/stream`, `/export/video`). The Beam flags above come from Beam's documentation, not from a run.
