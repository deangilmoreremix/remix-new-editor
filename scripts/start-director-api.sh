#!/usr/bin/env bash
# Start the Director Flask API server on port 8000
set -e
cd "$(dirname "$0")/apps/director/backend"
if [ ! -d ".venv" ]; then
  echo "Creating Python venv..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
else
  source .venv/bin/activate
fi
export SERVER_PORT="${SERVER_PORT:-8000}"
export SERVER_HOST="${SERVER_HOST:-0.0.0.0}"
export PYTHONUNBUFFERED=1
echo "Starting Director API on http://localhost:${SERVER_PORT}"
exec python -m director.entrypoint.api.server
