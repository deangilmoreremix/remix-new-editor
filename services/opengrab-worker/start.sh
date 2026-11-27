#!/bin/sh
# Starts the vendored OpenGrab on loopback with a throwaway internal token, then the gateway on $PORT.
set -eu

: "${WORKER_APP_SECRETS:?set WORKER_APP_SECRETS (app:secret,app:secret)}"

# Internal token: generated per start, shared only between the two processes in this container.
INTERNAL_TOKEN="$(python -c 'import secrets;print(secrets.token_hex(32))')"
export OPENGRAB_TOKEN="$INTERNAL_TOKEN" UPSTREAM_TOKEN="$INTERNAL_TOKEN"
export UPSTREAM_URL="http://127.0.0.1:${OPENGRAB_PORT:-8800}"
export OPENGRAB_MAX_JOBS="${GLOBAL_ACTIVE_JOBS:-5}" OPENGRAB_MAX_SIZE_MB="${MAX_FILE_MB:-2048}"

( cd /app/upstream && exec python app.py ) &
UP=$!
trap 'kill $UP 2>/dev/null || true' TERM INT EXIT

# wait for the engine before accepting traffic
i=0
until curl -fsS "http://127.0.0.1:${OPENGRAB_PORT:-8800}/health" >/dev/null 2>&1; do
  i=$((i+1)); [ "$i" -gt 60 ] && { echo "engine did not start" >&2; exit 1; }
  kill -0 "$UP" 2>/dev/null || { echo "engine exited" >&2; exit 1; }
  sleep 1
done

cd /app
exec python -m uvicorn gateway.app:build_from_env --factory --host 0.0.0.0 --port "${PORT:-8000}" --no-access-log
