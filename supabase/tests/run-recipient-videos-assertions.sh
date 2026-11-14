#!/usr/bin/env bash
# Runs 83_recipient_videos_assertions.sql against a throwaway local Postgres: the Supabase shim, a minimal storage.buckets stand-in,
# the publishing/analytics chain, recipient links and then the recipient-videos migration. No Supabase CLI, Docker or network.
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$(pwd)"; DB="svrvid_$$"
if [ -n "${PGHOST:-}" ]; then RUN() { "$@"; }; else RUN() { su postgres -c "$(printf '%q ' "$@")"; }; fi
RUN createdb "$DB"; trap 'RUN dropdb --if-exists "$DB" >/dev/null 2>&1' EXIT
apply() { PGOPTIONS="-c client_min_messages=warning" RUN psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$ROOT/$1" >/dev/null; }
apply supabase/tests/00_shim_local_postgres.sql
RUN psql -q -v ON_ERROR_STOP=1 -d "$DB" -c "create schema storage; create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);" >/dev/null
for f in 20260730_create_distributed_rate_limiter 20261105120000_create_published_videos 20261105160000_published_video_events 20261112000000_create_timeline_projects 20261112010000_publish_hardening_slugs 20261112020000_video_analytics 20261112030000_retargeting_notifications 20261112050000_drop_public_published_videos_read 20261115000000_recipient_links 20261118000000_recipient_videos; do apply "supabase/migrations/$f.sql"; done
RUN psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$ROOT/supabase/tests/83_recipient_videos_assertions.sql" 2>&1 | sed -n "s/^psql:.*NOTICE:  //p;/ALL ASSERTIONS/p;/ERROR/p;/error:/p"
