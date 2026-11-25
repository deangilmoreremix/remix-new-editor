# Running the backend on Beam (on demand)

Status: **written but not deployed or tested on Beam.** The Docker image could not be built in the authoring environment (no Docker daemon), and Beam's docs do not say how a Pod behaves on the first request after it has scaled to zero. Treat the first deploy as a trial. The same backend, started by `native-stack/start.sh`, was tested end to end.

## What it is
One Beam Pod (`app.py`) runs Postgres 16, Redis, NATS JetStream and the vendored Go backend. Postgres data, Redis and uploaded blobs live on a Beam `DurableDisk` mounted at `/data`, which Beam documents as surviving restarts. Only port 8080 (the API) is exposed. The Pod scales to zero after `keep_warm_seconds` (600) with no connections, so you pay only while it runs.

Only `backend` and `migrate` run. The `worker` and `consumer` services (warmup sending, scheduling, mailbox sync) are not started, so this setup is for browsing and testing live data, not for sending mail. Add them to `entrypoint.sh` and the Dockerfile build line when you want real warmup (that needs an always-on Pod, `keep_warm_seconds=-1`).

## Deploy
1. Install the Beam CLI and log in (`beam configure`).
2. Create the secrets. Generate fresh values; never reuse upstream's published dev keys.
   ```bash
   beam secret create KMS_LOCAL_MASTER_KEY "$(openssl rand -base64 32)"
   beam secret create CREDENTIALS_ENCRYPTION_KEY "$(openssl rand -hex 32)"
   beam secret create AUTH_SECRET "$(openssl rand -hex 32)"
   beam secret create PORTAL_EDGE_TOKEN "$(openssl rand -hex 24)"
   beam secret create INTERNAL_API_TOKEN "$(openssl rand -hex 24)"
   beam secret create STUDIO_ORIGINS "https://<where the studio is served>"
   beam secret create APP_URL "https://<where the studio is served>"
   # One login with the host app's Clerk session (POST /v1/auth/clerk). Beam needs every secret listed in app.py to exist,
   # so create all three. Values: Clerk dashboard > your app > API keys (Frontend API URL and secret key).
   beam secret create CLERK_ISSUER "https://<your Clerk Frontend API URL>"
   beam secret create CLERK_SECRET_KEY "sk_live_..."
   beam secret create CLERK_AUTHORIZED_PARTIES "https://<where the studio is served>"
   ```
   Check `CREDENTIALS_ENCRYPTION_KEY`'s expected length in `apps/warmbly-server/.env.example` first; the dev default is 64 hex characters.
3. From the repository root: `beam deploy apps/smartwarmupai-brand/beam/app.py:pod`
4. Beam prints the URL; `GET <url>/health` should return 200. The deployed Pod's stable URL is `https://<app-name>-<app-id>-latest-8080.app.beam.cloud`.
5. Point the dashboard at it by serving `config.js` next to the studio build:
   ```js
   window.__WARMBLY_ENV__ = { DEMO: "0", API_URL: "<beam url>", APP_URL: "<studio url>" };
   ```
   Without that file the studio stays in demo mode and needs no backend.

## First user
Registration is invite-only. Create the first account with `warmblyctl` (see `apps/warmbly-server/UPSTREAM.md`) from a `beam shell` or run command in the Pod. Do not run `cmd/seed`: it creates accounts with the fixed password `password123`, and this URL is public.

## Cautions
- The URL is public (`authorized=False`) because the browser calls it. Postgres, Redis and NATS listen on localhost only.
- `env.sh` keeps upstream's `APP_ENV=dev` and mail settings that point nowhere; outgoing email will fail until you set `MAIL_TRANSPORT`/SMTP values (add them as Beam secrets and to `SECRETS` in `app.py`).
- Beam notes that writes since the last disk snapshot can be lost if the worker is lost. Take your own `pg_dump` for anything you care about.
- Cold start: the first request after scale-to-zero may time out while Postgres, NATS and the backend boot. Beam does not document this case; if requests fail, start the Pod first (`beam deploy` again, or `pod.create`) and retry.
