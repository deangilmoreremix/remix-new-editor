#!/usr/bin/env bash
# Starts a Docker-less local stack for the vendored backend: Postgres 16, Redis, NATS (JetStream), a mail catcher, then
# migrates and runs the backend. Development only. Usage: start.sh [stop]
#   DATA=/var/lib/smartwarmupai  where Postgres keeps its data     BIN=./bin  where `npm run server:build` put the binaries
#   NATS=nats-server  nats binary (go install github.com/nats-io/nats-server/v2@latest)   PGBIN=/usr/lib/postgresql/16/bin
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; root="$(cd "$here/../../.." && pwd)"
DATA="${DATA:-/var/lib/smartwarmupai}"; BIN="${BIN:-$root/bin}"; PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"; NATS="${NATS:-nats-server}"
RUN="${RUN:-/tmp/smartwarmupai-run}"; mkdir -p "$RUN/mail" "$RUN/nats" "$DATA"
as_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }

if [ "${1:-}" = stop ]; then
  as_pg "$PGBIN/pg_ctl" -D "$DATA/pg" stop 2>/dev/null || true; redis-cli -p 16379 shutdown nosave 2>/dev/null || true
  pkill -f "$NATS" 2>/dev/null || true; pkill -f "$here/mail_sink.py" 2>/dev/null || true; pkill -f "$BIN/backend" 2>/dev/null || true; echo stopped; exit 0
fi

# Postgres on 15432 (first run creates the cluster, role and database)
if [ ! -d "$DATA/pg" ]; then
  mkdir -p "$DATA/pg"; [ "$(id -u)" = 0 ] && chown postgres:postgres "$DATA/pg"
  as_pg "$PGBIN/initdb" -D "$DATA/pg" -A trust >/dev/null
fi
if ! pg_isready -q -h 127.0.0.1 -p 15432; then
  rm -f "$DATA/pg/postmaster.pid"
  as_pg "$PGBIN/pg_ctl" -D "$DATA/pg" -o "-p 15432 -c max_locks_per_transaction=256 -c listen_addresses=127.0.0.1 -k /tmp" -l "$DATA/pg/log" -w start >/dev/null
fi
psql -h 127.0.0.1 -p 15432 -U postgres -tAc "select 1 from pg_roles where rolname='warmbly'" | grep -q 1 || psql -h 127.0.0.1 -p 15432 -U postgres -qc "CREATE ROLE warmbly LOGIN SUPERUSER PASSWORD 'warmbly'" -c "CREATE DATABASE warmbly_dev OWNER warmbly"
redis-cli -p 16379 ping >/dev/null 2>&1 || redis-server --port 16379 --daemonize yes --dir "$RUN" >/dev/null
pgrep -f "$NATS" >/dev/null || (nohup "$NATS" -js -sd "$RUN/nats" -m 8222 -p 4222 >"$RUN/nats.log" 2>&1 &)
pgrep -f "$here/mail_sink.py" >/dev/null || (nohup python3 "$here/mail_sink.py" "$RUN/mail" >"$RUN/mail.log" 2>&1 &)
sleep 2
set -a; . "$here/env.sh"; set +a
# Origins allowed to call the API: env.sh's default plus STUDIO_ORIGINS (comma separated), e.g. where the studio is served.
export CORS_ALLOW_ORIGINS="${STUDIO_ORIGINS:-http://localhost:5199,http://localhost:3100},${CORS_ALLOW_ORIGINS}" GEODB_PATH="${GEODB_PATH:-/tmp/none.mmdb}"
cd "$root/apps/warmbly-server"
"$BIN/migrate"
pkill -f "$BIN/backend" 2>/dev/null || true; sleep 1
(nohup "$BIN/backend" >"$RUN/backend.log" 2>&1 &)
for i in $(seq 1 60); do curl -fs localhost:8080/health >/dev/null 2>&1 && { echo "backend up on :8080 (logs $RUN/backend.log); mail caught in $RUN/mail"; exit 0; }; sleep 1; done
echo "backend did not become healthy; see $RUN/backend.log"; exit 1
