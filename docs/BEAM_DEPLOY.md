# Deploy SmartVidDownloader on Beam (one container, scales to zero)

`apps/vidbee/Dockerfile.beam` builds the whole web edition as **one container with one public port (3000)**: the web server serves the pages and proxies to the API running privately inside the same container. Data lives on one persistent disk.

It is a **bring-your-own-key** app: every visitor enters their own OpenAI key in the app (AI summary tab, *OpenAI settings*). Nothing OpenAI-related is stored on the server, so there is **no OpenAI secret to create on Beam**.

## 0. One-time Beam setup
1. Install the CLI (needs Python 3):

```bash
python3 -m venv .venv && source .venv/bin/activate && python -m pip install --upgrade beam-client
```

2. Log in. This opens your browser to sign in or create a Beam account (on a server with no browser use `beam login --browserless`, which prints a link to approve). Dashboard: https://platform.beam.cloud

```bash
beam login
```

3. Check it worked:

```bash
beam whoami
```

## 1. Deploy
Run from the `apps/vidbee` folder:

```bash
beam deploy --dockerfile Dockerfile.beam --name vidbee-downloader --port 3000 \
  --cpu 2 --memory 4Gi \
  --disk vidbee-data:/data:10Gi \
  --scale-to-zero --min-replicas 0 --max-replicas 1 \
  --keep-warm-seconds 300
```

- **Size:** 2 CPU and 4 GB, enough for the server-side speech model. You are billed only for the time it is actually running (see the next point).
- **Cost: it only runs while people use it.** `--scale-to-zero --min-replicas 0` stops it 5 minutes (`--keep-warm-seconds 300`) after the last request, so you pay only for active time. **Never use `--always-on` or `--min-replicas 1`**: that bills 24/7. `--max-replicas 1` means never two copies at once (SQLite, the task queue and live AI runs are in-process). The first visit after idle takes a few seconds longer while it starts.
- `--disk … :/data` keeps downloads (`/data/downloads`) and the database and settings (`/data/vidbee`) across restarts. A Beam disk cannot be shrunk once created, so pick the size you want the first time.
- **The URL** is printed when the deploy finishes, and it **changes with every deploy**. `beam deployment list` shows your deployments. Update `VIDBEE_WEB_URL` on the app backend after each deploy.
- `beam logs --stub-id <id from the deploy output>` shows startup. A healthy start ends with the web server listening on 3000.
- The URL is public. Add `authorized=True` (Python `Service.from_dockerfile(..., authorized=True)`) if you do not want that; then the app backend must send Beam's token.

## 2. Check it, and check the bill
1. Open the URL: the pages load, and the browser tab reads *SmartVidDownloader Web*.
2. Then try, in order: add a download, transcribe it, add your OpenAI key, run an AI prompt, export a video. Anything that fails shows in the logs.
3. About 5 minutes after you stop, run `beam container list`: it should say *No running containers*. Also run `beam vm list`: every VM should be `stopped` unless you started it on purpose. **A Beam VM bills around the clock even when idle** and is not part of this app.

## Colours (one deployment, three looks)
The page picks its palette from the address: `?brand=remix` (neon green, this repo's palette), `?brand=higgs` (cyan, the OpenHiggsBolt palette), or nothing for upstream VidBee's own amber. The choice is remembered in the browser. Light and dark follow *Settings, Theme* (System, Light or Dark). Each app embeds the URL with its own `brand`.

## 3. Connect the apps (side menu)
The app is built to live under `/vidbee/` and is reached through each host app's login gate (remix-new-editor: the Express backend; OpenHiggsBolt: the Next.js route with Clerk).

1. **Pick a shared secret** (a long random string, for example `openssl rand -hex 32`) and give the **same value** to all three places:
   - the Beam deploy: add `--env VIDBEE_GATE_TOKEN=<secret>` to the deploy command above (or use a Beam secret);
   - remix-new-editor's backend environment: `VIDBEE_GATE_TOKEN`;
   - OpenHiggsBolt's environment: `VIDBEE_GATE_TOKEN`.
   With it set, the Beam URL answers only requests that carry the secret, so nobody can use it directly.
2. **On each app's backend** also set `VIDBEE_WEB_URL` to the Beam URL (just the address, for example `https://<id>-3000.app.beam.cloud`) and `VIDBEE_ALLOWED_USERS` to the people allowed in (user ids or emails, comma separated).
3. **After every Beam deploy the URL changes.** Update `VIDBEE_WEB_URL` on both apps.
4. Each app opens the page with its own palette (`?brand=remix` or `?brand=higgs`), light or dark.

## What was and was not checked
- **Checked on Beam:** the image builds (Debian, because the speech library only ships glibc builds), the deploy succeeds, a real video download from Dailymotion completes, server-side speech recognition transcribes a speech clip correctly, the page loads, the AI settings endpoint reports a visitor's key (and only the last four characters), the Guide and About pages load, and the container shuts itself down after about 5 minutes idle.
- **Known limits:** YouTube blocks downloads from cloud servers unless you add cookies (Settings, Cookies); Vimeo and some other sites need a login; plain direct file links (.mp4) are refused by upstream's rules. Speech recognition on music-only videos produces made-up text.
- **Not checked:** an OpenAI call in the deployed container (it needs a visitor's key), and whether Beam cuts off long streams (`/stream`) or long video exports.
