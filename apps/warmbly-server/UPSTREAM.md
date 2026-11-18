# Upstream backend and services (vendored)

The backend and its services from https://github.com/warmbly/warmbly, vendored with upstream's own root layout
(`go.mod`, `cmd/`, `internal/`, `deploy/`, compose files, `Makefile`) so its build and run instructions work unchanged.
Licence: Apache License 2.0 (`LICENSE`). Source commit: `c2e36cc`. Nothing here is rewritten.

| Included | |
|---|---|
| `cmd/`, `internal/`, `go.mod`, `go.sum` | The Go control plane and execution plane: `backend` (API), `consumer`, `worker`, `forms`, `migrate`, `seed`, `sandbox`, `cli`, `warmblyctl`, `updater` |
| `deploy/`, `docker-compose*.yml`, `Makefile`, `scripts/` | Deployment manifests and tooling (Docker, systemd, Cloudflare, Coolify, split cloud) |
| `tracking/`, `realtime/`, `forms/`, `portal/`, `admin/` | Open/click tracking (Rust), realtime socket (Elixir), public forms and client portal apps, platform admin panel |
| `integrations/`, `hubspot-app/`, `pipedrive-app/`, `resources/` | Zapier/Make/HubSpot/Pipedrive integrations |
| `docs/embed.go`, `docs/content/docs`, `docs/public/openapi.json` | The `docs` Go package the backend embeds (its AI assistant and API catalog read it); identical to the docs ported to the Help site |

Left out on purpose: the dashboard (`../warmbly-web`), the docs site (`../smartwarmupai-help`), the marketing site, the iOS app, the QA harness, and upstream's `.github/` and `.greptile` (this repository does not use GitHub Actions). Add any of them by copying from the upstream commit.

## Run it

```bash
# with Docker (upstream's route): infra + services
cd apps/warmbly-server && make infra && make run      # see the Makefile; the dashboard is served by the studio, not the compose `web` service

# without Docker: build the binaries, then run them against your own Postgres 16, Redis and NATS (JetStream)
npm run server:build
source apps/smartwarmupai-brand/native-stack/env.sh   # dev settings; edit the DB/Redis/NATS URLs for your hosts
cd apps/warmbly-server && ../../bin/migrate && ../../bin/backend   # API on :8080, applies migrations
../../bin/seed   # optional demo workspace ("Sunrise Labs"); sandbox@warmbly.test / password123
```

Verified here: all eight services build from this copy, `migrate` applies all 400 migrations, `backend` answers `/health`, and the dashboard built from `../warmbly-web` logs in and reads real data from it.

## Connect the studio to it

The same dashboard build serves both modes. Demo mode is the default; to use this backend, serve a `config.js` next to the built app
(`public/smartwarmupai-app/config.js`) containing:

```js
window.__WARMBLY_ENV__ = { DEMO: "0", API_URL: "https://api.example.com", APP_URL: "https://app.example.com" };
```

and add the studio's origin to the backend's `CORS_ALLOW_ORIGINS`. No rebuild is needed. Set `EMAIL_BRAND_NAME=SmartWarmupAI` (and the other `EMAIL_BRAND_*` settings in `.env.example`) so mail and sign-in screens use the new name.

## What still needs you

- **Hosting:** the backend is long-running services plus Postgres, Redis and NATS. It cannot run on Netlify or Vercel. Use a VPS, Fly, Render or Kubernetes.
- **Real sending and syncing** need real mailboxes: Google and Microsoft OAuth apps (`BOX_GOOGLE_*`, `BOX_OUTLOOK_*`), DNS (SPF, DKIM, DMARC) for your domains, and an SMTP relay for the app's own email.
- **Not rebranded:** text produced by the backend itself (emails, API messages, the AI assistant's answers) comes from upstream's code and uses its own name unless set through the brand environment variables above. The dashboard and Help site are rebranded at build time.
- Cloud-only upstream features (its hosted warmup pool, billing) are not available to a self-hosted backend.
