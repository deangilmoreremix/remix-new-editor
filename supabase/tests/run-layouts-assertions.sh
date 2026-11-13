#!/usr/bin/env bash
# Runs 70_saved_layouts_assertions.sql against a throwaway local Postgres database (no Supabase CLI / Docker, no network).
# Usage: PGHOST=127.0.0.1 PGUSER=postgres supabase/tests/run-layouts-assertions.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="svlayouts_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/00_shim_local_postgres.sql >/dev/null
PGOPTIONS="-c client_min_messages=warning" psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/migrations/20261114000000_personalization_saved_layouts.sql >/dev/null
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/70_saved_layouts_assertions.sql 2>&1 | sed -n 's/^psql:.*NOTICE:  //p;/ALL ASSERTIONS/p;/ERROR/p'
