#!/usr/bin/env bash
# Stage 7: applies the migrations to a throwaway local Postgres and runs 70_heatmap_assertions.sql (non-zero exit on failure).
# Usage: PGHOST=... PGUSER=postgres supabase/tests/run-heatmap-assertions.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="svheat_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/00_shim_local_postgres.sql >/dev/null
for m in 20260730_create_distributed_rate_limiter 20261105120000_create_published_videos \
         20261105160000_published_video_events 20261112000000_create_timeline_projects \
         20261112010000_publish_hardening_slugs 20261112020000_video_analytics \
         20261112030000_retargeting_notifications 20261112040000_label_smartvideo_timeline_objects \
         20261112050000_drop_public_published_videos_read 20261114100000_heatmap_analytics 20261114100000_heatmap_analytics; do
  PGOPTIONS="-c client_min_messages=warning" psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "supabase/migrations/$m.sql" >/dev/null
done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/70_heatmap_assertions.sql 2>&1 | sed -n 's/^psql:.*NOTICE:  //p;/ALL HEATMAP/p;/ERROR/p'
