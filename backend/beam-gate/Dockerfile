# SmartVidDownloader gate for Beam. Build context: the repository root (app.py passes it).
FROM node:22-slim
WORKDIR /app
# Exact, locked dependencies (package.json + package-lock.json): the build installs precisely what was tested.
COPY backend/beam-gate/package.json backend/beam-gate/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY backend/services/vidbeeProxy.js ./services/vidbeeProxy.js
COPY backend/middleware/auth.js ./middleware/auth.js
COPY backend/beam-gate/gate-server.mjs ./gate-server.mjs
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
# The gate writes nothing to disk, so it runs as the unprivileged user that ships with the image.
USER node
CMD ["node", "gate-server.mjs"]
