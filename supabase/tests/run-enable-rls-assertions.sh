#!/usr/bin/env bash
# Runs 84_enable_rls_assertions.sql (which applies 20261120000000_enable_rls_on_exposed_tables.sql itself) on a throwaway local Postgres
# with the Supabase role shim. No Supabase CLI, Docker or network.
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$(pwd)"; DB="svrls_$$"
if [ -n "${PGHOST:-}" ]; then RUN() { "$@"; }; else RUN() { su postgres -c "$(printf '%q ' "$@")"; }; fi
RUN createdb "$DB"; trap 'RUN dropdb --if-exists "$DB" >/dev/null 2>&1' EXIT
PGOPTIONS="-c client_min_messages=warning" RUN psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$ROOT/supabase/tests/00_shim_local_postgres.sql" >/dev/null
(cd "$ROOT" && RUN psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$ROOT/supabase/tests/84_enable_rls_assertions.sql" 2>&1 | sed -n "s/^psql:.*NOTICE:  //p;/ALL ASSERTIONS/p;/ERROR/p;/error:/p")
