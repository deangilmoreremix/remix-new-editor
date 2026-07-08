# Maigret Worker

FastAPI service that wraps the [Maigret](https://github.com/soxoj/maigret)
username OSINT library and exposes a single `/scan` endpoint. The
`personalizer-api` Netlify function calls this worker to discover public
profiles for a contact (GitHub, LinkedIn, Twitter/X, Instagram, etc.)
and feed them into the contact enrichment pipeline.

## Endpoints

| Method | Path                    | Auth          | Description |
| ------ | ----------------------- | ------------- | ----------- |
| POST   | `/scan`                 | `X-API-Key`   | Run a Maigret scan for a username |
| GET    | `/health`               | none          | Liveness/readiness probe |
| GET    | `/cache/{username}`     | `X-API-Key`   | Inspect a cached result |
| DELETE | `/cache/{username}`     | `X-API-Key` (admin) | Invalidate a cached result |
| GET    | `/stats`                | `X-API-Key` (admin) | Per-key scan counts over the last hour |

### POST /scan

Request body:

```json
{
  "username": "shasheemoore",
  "top": 500,
  "isParsingEnabled": true,
  "timeoutMs": 15000,
  "enableCloudflareBypass": false,
  "parseUrl": null,
  "useCache": true
}
```

Response body:

```json
{
  "username": "shasheemoore",
  "platforms": [
    {
      "platform": "github",
      "url": "https://github.com/shasheemoore",
      "username": "shasheemoore",
      "status": "found",
      "ids_data": {
        "name": "Shashee Moore",
        "bio": "...",
        "company": "...",
        "location": "...",
        "avatar_url": "https://..."
      }
    }
  ],
  "summary": "Found 7 profile(s): github, twitter, linkedin",
  "confidence": 0.81,
  "cached": false,
  "durationMs": 23450,
  "sitesChecked": 487,
  "sitesFound": 7
}
```

## Quickstart (local dev)

### With Docker Compose (Redis cache)

```bash
cd services/maigret-worker
cp .env.example .env
# edit .env and set MAIGRET_API_KEY to a long random string
docker compose up --build
```

The worker listens on `http://localhost:8000`. Test it:

```bash
curl http://localhost:8000/health

curl -X POST http://localhost:8000/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $MAIGRET_API_KEY" \
  -d '{"username": "github", "top": 50}'
```

### With uvicorn directly (in-memory cache, faster iteration)

```bash
cd services/maigret-worker
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export MAIGRET_API_KEY=devkey
uvicorn app.main:app --reload --port 8000
```

## Deploy to Render.com

1. Push the `services/maigret-worker/` directory to a Git remote (GitHub/GitLab).
2. In the Render dashboard, click **New → Blueprint** and point it at the repo.
3. Render reads `render.yaml`, creates the `maigret-worker` web service, and
   auto-generates a `MAIGRET_API_KEY` value on first apply.
4. Copy the generated `MAIGRET_API_KEY` from the service's **Environment** tab.
5. Set `MAIGRET_API_KEY` in your Netlify environment to the same value.
6. Set `MAIGRET_WORKER_URL` in your Netlify environment to the Render service URL
   (e.g. `https://maigret-worker.onrender.com`).

The `personalizer-api` function will then call this worker whenever a user
clicks **Discover** in the Personalize popover.

## Deploy with a generic Docker host

```bash
docker build -t maigret-worker services/maigret-worker
docker run -d --name maigret-worker \
  -p 8000:8000 \
  -e MAIGRET_API_KEY=$(openssl rand -hex 32) \
  -e MAIGRET_CACHE_BACKEND=memory \
  maigret-worker
```

## Configuration

All config is via environment variables. See `.env.example` for the full
list. The most important ones:

| Variable                    | Default | Description |
| --------------------------- | ------- | ----------- |
| `MAIGRET_API_KEY`           | _none_  | Required. Clients send this in `X-API-Key`. |
| `MAIGRET_ADMIN_KEY`         | =API_KEY| Separate key for `/cache DELETE` and `/stats`. |
| `MAIGRET_CACHE_BACKEND`     | memory  | `memory` or `redis`. |
| `MAIGRET_CACHE_TTL_SECONDS` | 86400   | How long to cache a scan. |
| `MAIGRET_MAX_CONCURRENT`    | 4       | Semaphore that caps parallel scans. |
| `MAIGRET_PER_KEY_LIMIT`     | 100     | Scans per API key per hour. |
| `MAIGRET_SCAN_TIMEOUT`      | 90      | Hard timeout per scan. |
| `REDIS_URL`                 | localhost | Redis URL when `MAIGRET_CACHE_BACKEND=redis`. |
| `ALLOWED_ORIGINS`           | `*`     | CORS origin allowlist. |

## Caching

Maigret scans are expensive (each scan can hit hundreds of sites). The
service caches results by `username + top + isParsingEnabled` for
`MAIGRET_CACHE_TTL_SECONDS`.

- **memory**: in-process, fast, but only works for single-instance deploys.
- **redis**: shared across instances. The service degrades gracefully to
  the memory backend if Redis is unreachable at startup.

## Health and observability

- `GET /health` returns liveness info without auth (cache backend,
  timeout, whether an API key is configured). Use this for your
  platform's healthcheck (Render, K8s, ECS, etc.).
- `GET /stats` (admin) returns per-key scan counts over the last hour.

## Security

- All `/scan` requests must include `X-API-Key`. The server compares the
  header to `MAIGRET_API_KEY` using a constant-time string comparison
  (via `Header()` validation, not naive `==`).
- The `/cache DELETE` and `/stats` endpoints require `MAIGRET_ADMIN_KEY`,
  which defaults to `MAIGRET_API_KEY` if not set. Set it to a different
  value in production.
- Per-key rate limiting (sliding 1h window) protects against runaway
  clients. Tune `MAIGRET_PER_KEY_LIMIT`.
- CORS is locked down to `ALLOWED_ORIGINS`. Set this to the Netlify
  production domain in prod (e.g. `https://remix-new-editor.netlify.app`).

## Repository layout

```
services/maigret-worker/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI app, routes, auth, rate limit
│   ├── scanner.py       # Maigret library wrapper, normalizes output
│   └── cache.py         # Memory + Redis cache backends
├── Dockerfile
├── docker-compose.yml
├── render.yaml
├── requirements.txt
├── .env.example
└── README.md
```
