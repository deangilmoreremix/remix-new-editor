#!/usr/bin/env bash
# Boots Postgres, Redis, NATS and the backend inside one Beam Pod. Data lives on the durable disk (DATA, default /data).
# Mail settings (MAIL_TRANSPORT, SMTP_*, EMAIL_*) supplied by the caller override env.sh. Required secrets (set them as Beam secrets, see README.md): KMS_LOCAL_MASTER_KEY CREDENTIALS_ENCRYPTION_KEY AUTH_SECRET
# PORTAL_EDGE_TOKEN INTERNAL_API_TOKEN. Optional: STUDIO_ORIGINS (comma separated origins allowed to call the API), APP_URL.
set -euo pipefail
DATA="${DATA:-/data}"; PGBIN=/usr/lib/postgresql/16/bin; RUN=/tmp/run
for v in KMS_LOCAL_MASTER_KEY CREDENTIALS_ENCRYPTION_KEY AUTH_SECRET PORTAL_EDGE_TOKEN INTERNAL_API_TOKEN; do
  [ -n "${!v:-}" ] || { echo "missing required secret $v" >&2; exit 1; }
done
# Keep what the caller supplied: env.sh holds upstream's published dev defaults, which must never win.
keep=(KMS_LOCAL_MASTER_KEY CREDENTIALS_ENCRYPTION_KEY AUTH_SECRET PORTAL_EDGE_TOKEN INTERNAL_API_TOKEN STUDIO_ORIGINS APP_URL MAIL_TRANSPORT EMAIL_NAME EMAIL_ADDRESS EMAIL_BRAND_NAME SMTP_HOST SMTP_PORT SMTP_SECURITY SMTP_USERNAME SMTP_PASSWORD SMTP_AUTH SMTP_EHLO_NAME)
declare -A saved; for v in "${keep[@]}"; do saved[$v]="${!v:-}"; done
mkdir -p "$RUN/nats" "$DATA/pg" "$DATA/blobs" "$DATA/redis"
chown -R postgres:postgres "$DATA/pg"
as_pg() { runuser -u postgres -- "$@"; }
stop() { as_pg "$PGBIN/pg_ctl" -D "$DATA/pg" -m fast stop 2>/dev/null || true; redis-cli -p 16379 shutdown save 2>/dev/null || true; kill "${backend:-0}" 2>/dev/null || true; }
trap 'stop; exit 0' TERM INT

[ -f "$DATA/pg/PG_VERSION" ] || as_pg "$PGBIN/initdb" -D "$DATA/pg" -A trust >/dev/null
rm -f "$DATA/pg/postmaster.pid"
as_pg "$PGBIN/pg_ctl" -D "$DATA/pg" -o "-p 15432 -c max_locks_per_transaction=256 -c listen_addresses=127.0.0.1 -k /tmp" -l "$DATA/pg/log" -w start >/dev/null
psql -h 127.0.0.1 -p 15432 -U postgres -tAc "select 1 from pg_roles where rolname='warmbly'" | grep -q 1 \
  || psql -h 127.0.0.1 -p 15432 -U postgres -qc "CREATE ROLE warmbly LOGIN SUPERUSER PASSWORD 'warmbly'" -c "CREATE DATABASE warmbly_dev OWNER warmbly"
redis-server --port 16379 --bind 127.0.0.1 --daemonize yes --dir "$DATA/redis" >/dev/null
nats-server -js -sd "$RUN/nats" -a 127.0.0.1 -p 4222 >"$RUN/nats.log" 2>&1 &
sleep 2

set -a; . /app/env.sh; set +a
for v in "${keep[@]}"; do [ -z "${saved[$v]}" ] || export "$v=${saved[$v]}"; done
export BLOB_FS_ROOT="$DATA/blobs" GEODB_PATH=/tmp/none.mmdb
export CORS_ALLOW_ORIGINS="${STUDIO_ORIGINS:-},${CORS_ALLOW_ORIGINS}"
cd /app/src
/app/bin/migrate
/app/bin/backend &
backend=$!
wait "$backend"; stop
