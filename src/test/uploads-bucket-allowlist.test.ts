import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { UPLOAD_MIME_TYPES } from '../lib/editor/uploadLimits.js';

/**
 * Guard against the regression introduced by
 * 20260803000000_allow_pdfs_in_uploads_bucket.sql:
 *
 * That migration rewrote `storage.buckets.allowed_mime_types` for the `uploads`
 * bucket with `ON CONFLICT DO UPDATE SET`, replacing the whole allowlist in
 * order to add `application/pdf`. Forty-seven MIME types the app still accepts
 * were silently dropped — all audio types plus several image/video/text/
 * document/archive formats — so uploads passed client validation and then
 * failed at Supabase Storage.
 *
 * `src/lib/editor/uploadLimits.js` is the documented Single Source of Truth for
 * upload limits, so the bucket allowlist must be a superset of it.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, '../../supabase/migrations');
const BUCKET = 'uploads';

/** Strip `--` comment lines so SQL comments cannot pollute the parse. */
function stripComments(sql) {
  return sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
}

/** Extract the MIME types from every ARRAY[...] literal in a SQL fragment. */
function extractMimeTypes(sqlFragment) {
  const types = [];
  for (const match of sqlFragment.matchAll(/'([^']*)'/g)) {
    const value = match[1];
    if (value.includes('/')) types.push(value);
  }
  return types;
}

/**
 * Replay every migration that configures the `uploads` bucket, in filename
 * (chronological) order, and return the allowlist left in effect afterwards.
 */
function resolveEffectiveBucketAllowlist() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let allowlist = [];

  for (const file of files) {
    const sql = stripComments(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));

    const configuresUploadsBucket =
      sql.includes('storage.buckets') &&
      (sql.includes(`'${BUCKET}'`) || sql.includes(`"${BUCKET}"`));

    if (!configuresUploadsBucket) continue;

    // The last ARRAY literal in a migration is the final value: migrations that
    // re-insert the bucket put the new allowlist in their ON CONFLICT DO UPDATE
    // clause, which trails the INSERT ... VALUES clause.
    const arrays = [...sql.matchAll(/ARRAY\[([^\]]*)\]/g)].map((m) => m[1]);
    if (!arrays.length) continue;

    allowlist = extractMimeTypes(arrays[arrays.length - 1]);
  }

  return allowlist;
}

describe('supabase uploads bucket MIME allowlist', () => {
  const bucketAllowlist = new Set(resolveEffectiveBucketAllowlist());

  it('finds an allowlist configured in the migrations', () => {
    expect(bucketAllowlist.size).toBeGreaterThan(0);
  });

  it('has no duplicate MIME types in the effective allowlist', () => {
    const raw = resolveEffectiveBucketAllowlist();
    expect(new Set(raw).size).toBe(raw.length);
  });

  const declared = Array.from(
    new Set(Object.values(UPLOAD_MIME_TYPES).flatMap((types) => types || [])),
  );

  it('has at least one declared MIME type to compare against', () => {
    expect(declared.length).toBeGreaterThan(0);
  });

  // This is the regression guard: every client-declared MIME type must be
  // uploadable to the bucket, otherwise uploads fail after passing validation.
  it.each(declared)('allows %s, which uploadLimits.js declares as valid', (mime) => {
    expect(bucketAllowlist.has(mime)).toBe(true);
  });

  it('still allows PDFs (added by 20260803000000)', () => {
    expect(bucketAllowlist.has('application/pdf')).toBe(true);
  });

  it('allows every audio type (these were dropped by the regression)', () => {
    const audioTypes = UPLOAD_MIME_TYPES.audio || [];
    expect(audioTypes.length).toBeGreaterThan(0);
    for (const mime of audioTypes) {
      expect(bucketAllowlist.has(mime)).toBe(true);
    }
  });
});
