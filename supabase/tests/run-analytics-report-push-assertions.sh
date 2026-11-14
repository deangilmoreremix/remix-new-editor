#!/usr/bin/env bash
# Runs 82_analytics_report_push_assertions.sql against a throwaway local Postgres database: the Supabase shim, the rate limiter, the
# publishing + analytics + notification + recipient-link migrations the feature builds on, then the Stage 11 migration. No Supabase CLI,
# Docker or network.
# Usage (as a user that can run `su postgres`, or with PGHOST/PGUSER set): supabase/tests/run-analytics-report-push-assertions.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT="$(pwd)"
DB="svreport_$$"
if [ -n "${PGHOST:-}" ]; then RUN() { "$@"; }; else RUN() { su postgres -c "$(printf '%q ' "$@")"; }; fi
RUN createdb "$DB"
trap 'RUN dropdb --if-exists "$DB" >/dev/null 2>&1' EXIT
apply() { PGOPTIONS="-c client_min_messages=warning" RUN psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$ROOT/$1" >/dev/null; }
apply supabase/tests/00_shim_local_postgres.sql
apply supabase/migrations/20260730_create_distributed_rate_limiter.sql
apply supabase/migrations/20261105120000_create_published_videos.sql
apply supabase/migrations/20261105160000_published_video_events.sql
apply supabase/migrations/20261112000000_create_timeline_projects.sql
apply supabase/migrations/20261112010000_publish_hardening_slugs.sql
apply supabase/migrations/20261112020000_video_analytics.sql
apply supabase/migrations/20261112030000_retargeting_notifications.sql
apply supabase/migrations/20261112050000_drop_public_published_videos_read.sql
apply supabase/migrations/20261115000000_recipient_links.sql
apply supabase/migrations/20261117000000_analytics_report_push.sql
RUN psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$ROOT/supabase/tests/82_analytics_report_push_assertions.sql" 2>&1 | sed -n 's/^psql:.*NOTICE:  //p;/ALL ASSERTIONS/p;/ERROR/p'
