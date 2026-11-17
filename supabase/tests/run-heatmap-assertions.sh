#!/usr/bin/env bash
# Stage 7 (+ Stage 11 campaign filter: also applies 20261117100000 twice and runs 71_heatmap_campaign_assertions.sql; + Fix P: a second database gets 20261117200000 (campaign attribution) twice and runs 72_campaign_attribution_assertions.sql. 71 needs a database WITHOUT campaign_id, hence two databases): applies the migrations to a throwaway local Postgres and runs 70_heatmap_assertions.sql (non-zero exit on failure).
# HARDEN=1 first applies supabase/tests/05_hardening_preamble.sql (live-project hardening) before the heatmap migration.
# Usage: PGHOST=... PGUSER=postgres supabase/tests/run-heatmap-assertions.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DBS=()
cleanup() { for d in "${DBS[@]:-}"; do [ -n "$d" ] && dropdb --if-exists "$d" >/dev/null 2>&1 || true; done; }
trap cleanup EXIT
# build_db <name> <migration...>: shim + migrations in order (HARDEN=1 inserts the hardening preamble before the heatmap migration)
build_db() {
  local db="$1"; shift
  createdb "$db"; DBS+=("$db")
  psql -q -v ON_ERROR_STOP=1 -d "$db" -f supabase/tests/00_shim_local_postgres.sql >/dev/null
  local hardened=""
  for m in "$@"; do
    if [ "${HARDEN:-}" = 1 ] && [ "$m" = 20261114100000_heatmap_analytics ] && [ -z "$hardened" ]; then  # live-project hardening, see 05_hardening_preamble.sql
      psql -q -v ON_ERROR_STOP=1 -d "$db" -f supabase/tests/05_hardening_preamble.sql >/dev/null; hardened=1
    fi
    PGOPTIONS="-c client_min_messages=warning" psql -q -v ON_ERROR_STOP=1 -d "$db" -f "supabase/migrations/$m.sql" >/dev/null
  done
}
BASE="20260730_create_distributed_rate_limiter 20261105120000_create_published_videos \
      20261105160000_published_video_events 20261112000000_create_timeline_projects \
      20261112010000_publish_hardening_slugs 20261112020000_video_analytics \
      20261112030000_retargeting_notifications 20261112040000_label_smartvideo_timeline_objects \
      20261112050000_drop_public_published_videos_read 20261114100000_heatmap_analytics 20261114100000_heatmap_analytics \
      20261117100000_heatmap_campaign_filter 20261117100000_heatmap_campaign_filter"
FIXP="20261117200000_video_session_campaign_attribution 20261117200000_video_session_campaign_attribution"
filter() { sed -n 's/^psql:.*NOTICE:  //p;/ALL HEATMAP/p;/ERROR/p'; }

# shellcheck disable=SC2086
build_db "svheat_$$" $BASE
psql -q -v ON_ERROR_STOP=1 -d "svheat_$$" -f supabase/tests/70_heatmap_assertions.sql 2>&1 | filter
psql -q -v ON_ERROR_STOP=1 -d "svheat_$$" -f supabase/tests/71_heatmap_campaign_assertions.sql 2>&1 | filter

# Fix P: attribution write path on our branch alone (no campaign tables) and, inside 72, with minimal campaign tables
# (or the real ones when CAMPAIGNS_MIGRATION points at the campaigns branch migration, used by the trial worktree).
# shellcheck disable=SC2086
build_db "svattr_$$" $BASE ${CAMPAIGNS_MIGRATION_NAME:-} $FIXP
psql -q -v ON_ERROR_STOP=1 -d "svattr_$$" -f supabase/tests/72_campaign_attribution_assertions.sql 2>&1 | filter
