# Smartvid Downloader desktop app as a browser backend (host layer, not upstream). NOT TESTED in the build sandbox (no Docker there).
# Build from the repository's apps/smartvid directory:  docker build -f apps/desktop/host/docker/Dockerfile -t smartvid-web .
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN SMARTVID_BASE_PATH="${SMARTVID_BASE_PATH:-}" pnpm --filter ./apps/desktop run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production SMARTVID_HOST=0.0.0.0 SMARTVID_PORT=3300 SMARTVID_DATA_DIR=/data/smartvid SMARTVID_DOWNLOAD_DIR=/data/downloads SMARTVID_STATIC_DIR=out-web/renderer
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates python3 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp
WORKDIR /app
COPY --from=build /app /app
RUN cd apps/desktop && node host/setup-binaries.mjs && mkdir -p /data/smartvid /data/downloads
VOLUME ["/data/smartvid", "/data/downloads"]
EXPOSE 3300
WORKDIR /app/apps/desktop
# The server refuses to listen beyond loopback without SMARTVID_ACCESS_TOKEN (or SMARTVID_ALLOW_OPEN=1 behind your own auth).
CMD ["node", "out-web/server.mjs"]
