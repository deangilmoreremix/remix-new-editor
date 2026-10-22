-- ─────────────────────────────────────────────────────────────────────────────
-- Task 5 (unified-upload-repair) — Supabase `uploads` retention: DRY-RUN ONLY
--
-- SHARED-BUCKET CONTEXT
-- The `uploads` bucket is shared and public across several apps. This app's
-- objects live under the `smartvideo/${userId}/...` prefix. Temporary
-- AI-generation inputs are tracked in public.muapi_upload_cache with a
-- 1-hour lifetime (see src/lib/muapiUpload.js URL_LIFETIME_MS); persistent
-- assets are tracked in public.media (project / media-library rows) and
-- public.content_library (content-library rows), with generation outputs in
-- public.generations.
--
-- WHAT THIS SCRIPT DOES
-- Reports the set of EXPIRED temporary-upload rows that WOULD be candidates
-- for removal, after excluding anything still referenced by the protected
-- tables above. Reporting only: SELECT + RAISE NOTICE. No storage objects
-- are removed by this script.
--
-- SAFETY DEFAULTS (binding)
-- - DISABLED by default: the DRY_RUN guard below defaults to false, which
--   means report-only mode. No automatic execution is configured.
-- - No pg_cron job is created by this migration (scheduling intentionally
--   omitted — dry-run evidence must be reviewed before anything is enabled).
-- - No storage policy statements are included here; Timeline, CineGen and
--   Chat access is untouched.
-- - Cinema Template assets, Template Studio assets, user-saved templates,
--   media-library assets, existing project media and files referenced by
--   active generation jobs are never candidates: a row is reported only when
--   its URL is absent from every protected table.
--
-- IDEMPOTENT: CREATE OR REPLACE VIEW + self-contained DO blocks. Safe to
-- re-run; re-running only refreshes the report.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ Candidate view: expired cache rows with no protected reference ═════════
-- Expiry source: muapi_upload_cache.expires_at (MuAPI presigned URLs live
-- ~1 hour; anything with expires_at < now() is past its useful life).
-- Protected references checked inline: media.url, media.path,
-- content_library.url, content_library.storage_path. The optional
-- public.generations cross-check lives in the DO block below (dynamic SQL),
-- because a static view would fail to create on databases where that table
-- is absent.
--
-- WARNING: generations.url exclusion is applied at REPORT TIME ONLY (see the
-- DO block below), not in this view. A static NOT EXISTS against
-- public.generations cannot live here because the generations table may not
-- exist on all databases, and the view would then fail to create. Treat every
-- row of this view as "unreferenced except possibly by generations.url" and
-- always apply the report-time generations filter before acting on it.
-- NOTE: the exposed column is named `url` (full URL semantics), NOT `path`.
-- Never interpret it as a storage-object key / bucket key; resolving a bucket
-- key requires parsing the URL first.
CREATE OR REPLACE VIEW public.muapi_upload_retention_dry_run AS
SELECT
  public.muapi_upload_cache.url AS url,
  public.muapi_upload_cache.user_id AS user_id,
  public.muapi_upload_cache.asset_id AS asset_id,
  public.muapi_upload_cache.category AS category,
  public.muapi_upload_cache.expires_at AS expires_at,
  floor(extract(epoch from (now() - public.muapi_upload_cache.expires_at)) / 86400)::integer AS days_expired
FROM public.muapi_upload_cache
WHERE public.muapi_upload_cache.expires_at < now()
  AND NOT EXISTS (
    SELECT 1 FROM public.media
    WHERE public.media.url = public.muapi_upload_cache.url
       OR public.media.path = public.muapi_upload_cache.url
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.content_library
    WHERE public.content_library.url = public.muapi_upload_cache.url
       OR public.content_library.storage_path = public.muapi_upload_cache.url
  );

-- ══ Security posture for the view (report-only; grant model) ═══════════════
-- With security_invoker the view executes with the CALLER's rights, so the
-- verified-identity RLS on public.muapi_upload_cache (see
-- 20261014120000_smartvideo_media_rls_tagged.sql) applies exactly as if the
-- caller had selected the table directly; the view can no longer expose rows
-- the table's own policies would deny. security_barrier makes no difference
-- to this definition (plain equality / NOT EXISTS predicates only) and simply
-- blocks leaky-function workarounds if the definition is extended later.
-- Default PUBLIC grants are revoked so other apps' anon clients on the shared
-- database get nothing; only the service role may read the report (house
-- idiom: GRANT ... TO service_role). Statements are re-applied on every run,
-- keeping this migration idempotent.
ALTER VIEW public.muapi_upload_retention_dry_run SET (security_invoker = true);
ALTER VIEW public.muapi_upload_retention_dry_run SET (security_barrier = true);
REVOKE ALL ON public.muapi_upload_retention_dry_run FROM PUBLIC;
GRANT SELECT ON public.muapi_upload_retention_dry_run TO service_role;

-- ══ Dry-run audit report (report-only; removes nothing) ════════════════════
DO $$
DECLARE
  -- DRY_RUN guard. false = DISABLED / report-only (default, binding).
  -- Even with DRY_RUN set to true the branch below stays report-only: no
  -- removal statements exist in this script by design. Actual cleanup may
  -- only be introduced by a later migration after dry-run evidence review.
  DRY_RUN boolean := false;
  expired_total integer := 0;
  candidate_total integer := 0;
  gen_protected_total integer := 0;
  has_cache boolean := false;
  has_generations boolean := false;
  sample record;
BEGIN
  SELECT (to_regclass('public.muapi_upload_cache') IS NOT NULL) INTO has_cache;
  IF NOT has_cache THEN
    RAISE NOTICE '[retention dry-run] public.muapi_upload_cache is absent; nothing to audit.';
  ELSE
    IF DRY_RUN THEN
      RAISE NOTICE '[retention dry-run] DRY_RUN=true requested, but this script is report-only by design: no storage objects removed.';
    ELSE
      SELECT count(*) INTO expired_total
      FROM public.muapi_upload_cache
      WHERE public.muapi_upload_cache.expires_at < now();

      SELECT count(*) INTO candidate_total
      FROM public.muapi_upload_retention_dry_run;

      RAISE NOTICE '[retention dry-run] DRY_RUN=false (DISABLED, report only): % expired cache rows, % unreferenced candidates.',
        expired_total, candidate_total;

      SELECT (to_regclass('public.generations') IS NOT NULL) INTO has_generations;
      IF has_generations THEN
        EXECUTE
          'SELECT count(*) FROM public.muapi_upload_retention_dry_run v '
          'WHERE EXISTS (SELECT 1 FROM public.generations g WHERE g.url = v.url)'
          INTO gen_protected_total;
        RAISE NOTICE '[retention dry-run] % candidates are still referenced via generations.url and stay protected (excluded from WOULD-REMOVE below).',
          gen_protected_total;
        FOR sample IN EXECUTE
          'SELECT v.url, v.user_id, v.asset_id, v.category, v.expires_at, v.days_expired '
          'FROM public.muapi_upload_retention_dry_run v '
          'WHERE EXISTS (SELECT 1 FROM public.generations g WHERE g.url = v.url) '
          'ORDER BY v.expires_at LIMIT 25'
        LOOP
          RAISE NOTICE '[retention dry-run] generations-protected url=% user_id=% asset_id=% category=% expires_at=% days_expired=%',
            sample.url, sample.user_id, sample.asset_id, sample.category, sample.expires_at, sample.days_expired;
        END LOOP;

        -- WOULD-REMOVE sample: only candidates NOT referenced by generations.url.
        FOR sample IN EXECUTE
          'SELECT v.url, v.user_id, v.asset_id, v.category, v.expires_at, v.days_expired '
          'FROM public.muapi_upload_retention_dry_run v '
          'WHERE NOT EXISTS (SELECT 1 FROM public.generations g WHERE g.url = v.url) '
          'ORDER BY v.expires_at LIMIT 50'
        LOOP
          RAISE NOTICE '[retention dry-run] WOULD-REMOVE candidate url=% user_id=% asset_id=% category=% expires_at=% days_expired=% (no removal performed)',
            sample.url, sample.user_id, sample.asset_id, sample.category, sample.expires_at, sample.days_expired;
        END LOOP;
      ELSE
        RAISE NOTICE '[retention dry-run] LIMITATION: public.generations is absent, so generation-output references cannot be cross-checked on this database.';
        FOR sample IN
          SELECT v.url, v.user_id, v.asset_id, v.category, v.expires_at, v.days_expired
          FROM public.muapi_upload_retention_dry_run v
          ORDER BY v.expires_at LIMIT 50
        LOOP
          RAISE NOTICE '[retention dry-run] WOULD-REMOVE candidate url=% user_id=% asset_id=% category=% expires_at=% days_expired=% (no removal performed)',
            sample.url, sample.user_id, sample.asset_id, sample.category, sample.expires_at, sample.days_expired;
        END LOOP;
      END IF;

      RAISE NOTICE '[retention dry-run] complete: % WOULD-be-removed candidates listed above; 0 objects removed.', candidate_total;
    END IF;
  END IF;
END $$;
