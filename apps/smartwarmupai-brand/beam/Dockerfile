# SmartWarmupAI backend for Beam: Postgres 16 + Redis + NATS (JetStream) + the vendored Go backend in one image.
# Build context: the repository root (Beam's Image.from_dockerfile is given the context dir in app.py).
FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY apps/warmbly-server/go.mod apps/warmbly-server/go.sum ./
RUN go mod download
COPY apps/warmbly-server/ ./
RUN CGO_ENABLED=0 go build -o /out/ ./cmd/backend ./cmd/migrate ./cmd/warmblyctl

FROM nats:2-alpine AS nats

FROM postgres:16-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends redis-server curl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=nats /usr/local/bin/nats-server /usr/local/bin/nats-server
COPY --from=build /out/ /app/bin/
# Migrations and templates the backend reads relative to its working directory.
COPY apps/warmbly-server/ /app/src/
COPY apps/smartwarmupai-brand/beam/env.sh apps/smartwarmupai-brand/beam/entrypoint.sh /app/
RUN chmod +x /app/entrypoint.sh
EXPOSE 8080
ENTRYPOINT []
