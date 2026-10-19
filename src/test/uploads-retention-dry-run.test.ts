import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Task 5 (unified-upload-repair) — Supabase `uploads` retention, dry-run only.
 *
 * Guards the retention audit migration
 * (20261014200000_supabase_uploads_retention_dry_run.sql):
 *
 * - The script must REPORT expired temporary-upload candidates only. It must
 *   never remove storage objects, schedule automatic cleanup, or touch the
 *   shared storage policies that Timeline, CineGen and Chat rely on.
 * - Expiry is sourced from muapi_upload_cache.expires_at (1-hour MuAPI
 *   presigned-URL lifetime), and every candidate must be cross-checked
 *   against the protected tables (media, content_library) so persistent
 *   assets — Cinema Template assets, Template Studio assets, user-saved
 *   templates, media-library assets, existing project media — can never be
 *   listed as removal candidates.
 */

const MIGRATION_FILE = '20261014200000_supabase_uploads_retention_dry_run.sql';
const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');
const FILE_PATH = path.join(MIGRATIONS_DIR, MIGRATION_FILE);

function readSql(): string {
  return fs.readFileSync(FILE_PATH, 'utf8');
}

describe('supabase uploads retention dry-run (Task 5)', () => {
  it('migration file exists', () => {
    expect(fs.existsSync(FILE_PATH)).toBe(true);
  });

  it('performs no removal of storage objects', () => {
    expect(readSql()).not.toContain('DELETE FROM storage.objects');
  });

  it('schedules no pg_cron retention job (disabled by default)', () => {
    const sql = readSql();
    expect(sql).not.toContain('cron.schedule');
    expect(sql).toContain('DISABLED');
  });

  it('sources expiry from muapi_upload_cache.expires_at', () => {
    expect(readSql()).toContain('muapi_upload_cache.expires_at');
  });

  it('uses expires_at < as the expiry condition', () => {
    expect(readSql()).toContain('expires_at <');
  });

  it.each(['media.url', 'media.path', 'content_library.url', 'content_library.storage_path'])(
    'cross-references protected table column %s',
    (ref) => {
      expect(readSql()).toContain(ref);
    },
  );

  it('cross-checks the generations table when present', () => {
    expect(readSql()).toContain('public.generations');
  });

  it('has a DRY_RUN guard that defaults to disabled', () => {
    const sql = readSql();
    expect(sql).toContain('DRY_RUN');
    expect(sql).toMatch(/DRY_RUN\s+boolean\s*:=\s*false/i);
  });

  it('changes no storage policies', () => {
    const sql = readSql();
    expect(sql).not.toContain('ALTER POLICY');
    expect(sql).not.toContain('CREATE POLICY');
    expect(sql).not.toContain('DROP POLICY');
  });

  it('is idempotent (replaceable view + DO blocks)', () => {
    const sql = readSql();
    expect(sql).toContain('DO $$');
    expect(sql).toContain('CREATE OR REPLACE VIEW');
  });
});
