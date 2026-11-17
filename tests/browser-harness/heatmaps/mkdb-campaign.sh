set -e
# Usage: mkdb-campaign.sh <dbname> [campaigns-migration.sql]   (run as root; uses `su postgres`)
# Stage 11 (Fix P): every migration through the campaign attribution one (applied twice). When a campaigns migration path is given
# it is applied BEFORE the attribution migration (the trial worktree passes the campaigns branch's file); without it there are no campaign tables.
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"
DB=$1; CAMP=${2:-}
su postgres -c "dropdb --if-exists $DB; createdb $DB"
run(){ su postgres -c "PGOPTIONS='-c client_min_messages=warning' psql -q -v ON_ERROR_STOP=1 -d $DB -f $1" >/dev/null; }
run "$ROOT/supabase/tests/00_shim_local_postgres.sql"
for m in 20260730_create_distributed_rate_limiter 20261105120000_create_published_videos 20261105160000_published_video_events 20261112000000_create_timeline_projects 20261112010000_publish_hardening_slugs 20261112020000_video_analytics 20261112030000_retargeting_notifications 20261112040000_label_smartvideo_timeline_objects 20261112050000_drop_public_published_videos_read 20261114100000_heatmap_analytics 20261117100000_heatmap_campaign_filter; do run "$ROOT/supabase/migrations/$m.sql"; done
[ -n "$CAMP" ] && run "$CAMP"
run "$ROOT/supabase/migrations/20261117200000_video_session_campaign_attribution.sql"
run "$ROOT/supabase/migrations/20261117200000_video_session_campaign_attribution.sql"
echo migrated ok
