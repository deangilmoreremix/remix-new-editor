set -e
cd /home/user/wt-stage7
DB=$1
su postgres -c "dropdb --if-exists $DB; createdb $DB"
P="su postgres -c"
run(){ su postgres -c "PGOPTIONS='-c client_min_messages=warning' psql -q -v ON_ERROR_STOP=1 -d $DB -f $1" >/dev/null; }
run /home/user/wt-stage7/supabase/tests/00_shim_local_postgres.sql
for m in 20260730_create_distributed_rate_limiter 20261105120000_create_published_videos 20261105160000_published_video_events 20261112000000_create_timeline_projects 20261112010000_publish_hardening_slugs 20261112020000_video_analytics 20261112030000_retargeting_notifications 20261112040000_label_smartvideo_timeline_objects 20261112050000_drop_public_published_videos_read 20261114100000_heatmap_analytics; do run /home/user/wt-stage7/supabase/migrations/$m.sql; done
run /home/user/wt-stage7/supabase/migrations/20261114100000_heatmap_analytics.sql
echo migrated twice ok
