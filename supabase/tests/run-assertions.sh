#!/usr/bin/env bash
# Runs the asserting SQL checks against a throwaway local Postgres database (no Supabase CLI / Docker).
# HARDEN=1 first applies supabase/tests/05_hardening_preamble.sql (live-project hardening) before the heatmap migration.
# Usage: PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=... supabase/tests/run-assertions.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB="svassert_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/00_shim_local_postgres.sql >/dev/null
for m in 20260730_create_distributed_rate_limiter 20261104120000_create_video_leads 20261105120000_create_published_videos \
         20261105160000_published_video_events 20261112000000_create_timeline_projects \
         20261112010000_publish_hardening_slugs 20261112020000_video_analytics \
         20261112030000_retargeting_notifications 20261112040000_label_smartvideo_timeline_objects 20261112050000_drop_public_published_videos_read \
         20261114100000_heatmap_analytics 20261115000000_strip_all_notification_addresses 20261115000000_video_personalizations 20261115120000_guest_limits \
         20261119150000_video_owner_custom_domain 20261119170000_custom_domain_verified 20261120120000_custom_domain_admin_alert 20261127120000_domain_claims_hardening; do  # heatmap_analytics redefines prune_video_analytics / delete_video_analytics (Stage 7): 50_assertions must still hold
  if [ "${HARDEN:-}" = 1 ] && [ "$m" = 20261114100000_heatmap_analytics ] && [ -z "${HARDENED_DONE:-}" ]; then  # live-project hardening, see 05_hardening_preamble.sql
    psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/05_hardening_preamble.sql >/dev/null; HARDENED_DONE=1
  fi
  PGOPTIONS="-c client_min_messages=warning" psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "supabase/migrations/$m.sql" >/dev/null
done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/50_assertions.sql 2>&1 | sed -n 's/^psql:.*NOTICE:  //p;/ALL ASSERTIONS/p;/ERROR/p'
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/51_personalizations_assertions.sql 2>&1 | sed -n 's/^psql:.*NOTICE:  //p;/ALL PERSONALIZATION ASSERTIONS/p;/ERROR/p'
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/52_guest_assertions.sql 2>&1 | sed -n 's/^psql:.*NOTICE:  //p;/ALL GUEST ASSERTIONS/p;/ERROR/p'
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/53_custom_domain_alert_assertions.sql 2>&1 | sed -n 's/^psql:.*NOTICE:  //p;/ALL CUSTOM DOMAIN ALERT ASSERTIONS/p;/ERROR/p'
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/54_domain_claims_hardening_assertions.sql 2>&1 | sed -n 's/^psql:.*NOTICE:  //p;/ALL DOMAIN CLAIMS ASSERTIONS/p;/ERROR/p'
