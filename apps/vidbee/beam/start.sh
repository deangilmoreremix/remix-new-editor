#!/bin/sh
# One container, one public port (3000): the API runs privately on 127.0.0.1:3100 and the web server proxies to it.
set -eu

mkdir -p "$VIDBEE_DOWNLOAD_DIR" "$VIDBEE_DATA_DIR"

(cd /app/api && node dist/migrate-history.js && exec node dist/index.js) &
API_PID=$!

# Wait for the API before serving pages (up to ~60 s).
i=0
until wget -qO- "http://127.0.0.1:${VIDBEE_API_PORT}/health" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 120 ] || ! kill -0 "$API_PID" 2>/dev/null; then
    echo "VidBee API did not become healthy" >&2
    kill "$API_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 0.5
done

(cd /app/web && exec node server.mjs) &
WEB_PID=$!

stop() { kill "$API_PID" "$WEB_PID" 2>/dev/null || true; }
trap stop TERM INT

# If either process exits, stop the other and exit so the platform restarts the whole container.
while kill -0 "$API_PID" 2>/dev/null && kill -0 "$WEB_PID" 2>/dev/null; do
  sleep 2
done
stop
wait
exit 1
