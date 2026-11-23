# VidBee desktop app as a browser backend (host layer, not upstream). NOT TESTED in the build sandbox (no Docker there).
# Build from the repository's apps/vidbee directory:  docker build -f apps/desktop/host/docker/Dockerfile -t vidbee-web .
FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/* \
 && corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN VIDBEE_BASE_PATH="${VIDBEE_BASE_PATH:-}" pnpm --filter ./apps/desktop run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production VIDBEE_HOST=0.0.0.0 VIDBEE_PORT=3300 VIDBEE_DATA_DIR=/data/vidbee VIDBEE_DOWNLOAD_DIR=/data/downloads VIDBEE_STATIC_DIR=out-web/renderer
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates python3 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp
WORKDIR /app
COPY --from=build /app /app
RUN cd apps/desktop && node host/setup-binaries.mjs && mkdir -p /data/vidbee /data/downloads
VOLUME ["/data/vidbee", "/data/downloads"]
EXPOSE 3300
WORKDIR /app/apps/desktop
# The server refuses to listen beyond loopback without VIDBEE_ACCESS_TOKEN (or VIDBEE_ALLOW_OPEN=1 behind your own auth).
CMD ["node", "out-web/server.mjs"]
