# Video Agent Studio 2 — Production Deployment

The SmartVideo root application is deployed through its existing
deployment pipeline (Render / Netlify). Video Agent Studio 2 — the
complete OpenChatCut application imported at
`apps/video-agent-studio/` — runs as its **own application on its
own host**. SmartVideo embeds Studio 2 through an iframe whose URL
is set via `VITE_VIDEO_AGENT_STUDIO_URL`.

## Architecture

```
            SMARTVIDEO                              OPENCHATCUT
   (existing SmartVideo deploy)            (apps/video-agent-studio/)
                    │                                    │
                    │   <iframe> from                    │
                    │   VITE_VIDEO_AGENT_STUDIO_URL      │
                    └───────────────────────────────────►│
                                                         │
                                                  ┌──────┴──────┐
                                                  │ Vite +     │
                                                  │ OpenChatCut │
                                                  │ server      │
                                                  │ (Node >= 24)│
                                                  │ FFmpeg      │
                                                  │ Remotion    │
                                                  └─────────────┘
```

SmartVideo and OpenChatCut do **not** share a backend, a database,
a media store, a credit ledger, or any in-process state. They
communicate only via HTTP at the iframe boundary.

## Production URL

Use a host capable of running a Node 24+ process, FFmpeg, and
Remotion. The recommended production hostname is:

```
https://video-agent.smartvid.app
```

Set this in the SmartVideo production environment:

```
VITE_VIDEO_AGENT_STUDIO_URL=https://video-agent.smartvid.app
```

The SmartVideo CSP allows this origin in `frame-src` (see
`vite.config.js`).

## Local development URL

```
VITE_VIDEO_AGENT_STUDIO_URL=http://localhost:5199
```

The root npm scripts in this repo (`npm run dev:video-agent-studio`,
`npm run dev:all`, `npm run install:video-agent-studio`,
`npm run build:video-agent-studio`, `npm run test:video-agent-studio`,
`npm run verify:video-agent-studio`) operate on the
`apps/video-agent-studio/` subtree with its own `package.json` and
its own Vite/TypeScript build chain.

## Required runtime

* **Node.js** 24.x (per `apps/video-agent-studio/package.json`
  `engines.node`).
* **FFmpeg** available on the host PATH. OpenChatCut uses FFmpeg
  for media processing and export.
* **Remotion** binaries. OpenChatCut runs Remotion for server-side
  rendering. The first build downloads ~150 MB of Remotion
  binaries; the host must allow that.

## Persistent storage

OpenChatCut is local-first. The production host should mount a
persistent volume at the path OpenChatCut uses for projects,
media, models and cache. The default location is derived from
the user's profile; for server deployments OpenChatCut exposes
runtime-profile helpers under `apps/video-agent-studio/server/`
that resolve a stable data directory.

Recommended layout:

```
/var/lib/openchatcut/
├── projects/    # ProjectDoc storage
├── media/       # Imported media + generated assets
├── models/      # Local ASR + multimodal models
├── cache/       # Transcription / generation cache
└── mcp/         # MCP runtime state
```

Mount this volume from a managed disk (Render Persistent Disk, RDS
or equivalent). The host process must have read/write access.

## Environment variables

OpenChatCut reads its own environment variables. The complete
list lives in `apps/video-agent-studio/server/runtime-profile.ts`
and the `apps/video-agent-studio/.env.example` file (if present).
At minimum the production host must set:

```
NODE_ENV=production
# A stable port for the OpenChatCut HTTP server (e.g. 5199).
# The default in scripts/dev-profile.mjs is fine for dev; for
# production you may want to set it explicitly via the
# OpenChatCut server's own start command.
#
# FFmpeg path (optional, defaults to ffmpeg-static bundled binary)
FFMPEG_PATH=/usr/bin/ffmpeg
#
# Persistent data directory (server-side runtime profile)
OPENCHATCUT_DATA_DIR=/var/lib/openchatcut
```

Provider keys (OpenAI, Anthropic, etc.) are configured **inside
Studio 2's own settings UI**, not in this SmartVideo environment.
They are stored in the OpenChatCut keystore under the data
directory above.

## Start command

In production OpenChatCut is started with its own dev / start
pipeline. The exact command depends on the host. Two reference
paths:

* **Vite-only static SPA mode** (simplest; recommended for the
  initial iframe integration where the Vite dev middleware is not
  needed):

  ```bash
  cd apps/video-agent-studio
  npm install
  npm run build           # tsc -b && vite build
  npx vite preview --config config/vite.config.ts --port 5199 --host
  ```

  This serves the static SPA at `http://localhost:5199/`. The
  server-side plugins (agent runtime, project store, media
  processing, MCP) may not all be available in this mode; the
  OpenChatCut frontend will fall back to local-first / client-only
  behaviour for any plugin the host does not provide.

* **Full OpenChatCut dev profile** (recommended for production
  where the OpenChatCut server-side plugins are required):

  ```bash
  cd apps/video-agent-studio
  npm install
  npm run dev             # node scripts/dev-profile.mjs
  ```

  This starts the Vite dev server with all OpenChatCut plugins
  attached. It is the same command used in development. Operators
  that need a hardened production runtime should review
  `apps/video-agent-studio/scripts/dev-profile.mjs`,
  `apps/video-agent-studio/server/`, and the OpenChatCut
  `e2b.Dockerfile` for a reference production container shape.

Verify the actual start command against the current
`apps/video-agent-studio/package.json` `scripts` before deploying.

## Health check

The SmartVideo shell does not require a custom health check
beyond the iframe URL responding 200. Operators that need a
deeper check can use OpenChatCut's own MCP or runtime-profile
endpoints.

## Dockerfile (only if one does not already exist upstream)

If a Dockerfile is not already present in
`apps/video-agent-studio/`, add one with at least:

* `node:24-bookworm` (or compatible) base.
* `apt-get install ffmpeg` (or use a multi-stage build that
  pulls a static FFmpeg).
* `WORKDIR /app`
* `COPY package.json package-lock.json ./`
* `RUN npm ci --omit=dev` (with the subtree's lockfile).
* `COPY . .`
* `RUN npm run build`
* `EXPOSE 5199`
* `CMD ["node", "server/dist/server.js"]`
* `VOLUME ["/var/lib/openchatcut"]`

## What this document does NOT cover

* SmartVideo's own deployment (unchanged).
* OpenChatCut's provider model registry (configured inside
  Studio 2's settings).
* Cross-host authentication. The iframe is a public embedding;
  if authenticated access is required, OpenChatCut's own auth
  is configured inside the studio.
