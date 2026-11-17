import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { createServerClient } from '../../../../src/lib/supabase'
import { logPersonalization, createCorrelationId } from '../../../../src/server/personalizationLog'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Stores an image edited in the Personalization Image Editor so it has a
 * durable URL (see src/shared/personalization/editedAssetPersistence.ts).
 *
 * The file goes to the same `personalization-assets` bucket the asset upload
 * route uses, under the caller's own Clerk user prefix (taken from the
 * session, never from the request), so one user can't write into another's
 * folder. Request: multipart form with `image` (the file) and `metadata`
 * (JSON with at least `assetId`). Response: `{ ok, assetId, publicUrl, ... }`.
 */

const BUCKET = 'personalization-assets'
// Netlify buffers function bodies up to ~6 MB (Base64), so ~4.5 MB of image.
const MAX_IMAGE_BYTES = 4_500_000
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const EXTENSION: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

function sanitizeSegment(value: string, fallback = 'x'): string {
  const cleaned = String(value)
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/^[.-]+/, '')
    .slice(0, 96)
  return cleaned || fallback
}

export async function POST(req: NextRequest) {
  const correlationId = createCorrelationId(req)
  const route = '/api/personalization/persist-edited-asset'

  const { userId } = await auth()
  if (!userId) {
    logPersonalization({ route, stage: 'auth', httpStatus: 401, safeErrorCode: 'UNAUTHENTICATED', safeMessage: 'No authenticated user', correlationId })
    return NextResponse.json({ error: 'Sign in to save edited images.' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a multipart form with an image.' }, { status: 400 })
  }

  const image = form.get('image')
  if (!(image instanceof Blob)) {
    return NextResponse.json({ error: 'Missing image.' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(image.type)) {
    return NextResponse.json({ error: 'The edited image must be PNG, JPEG or WebP.' }, { status: 415 })
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'The edited image is too large to save (max 4.5 MB).' }, { status: 413 })
  }

  let metadata: Record<string, unknown> = {}
  try {
    const raw = form.get('metadata')
    if (typeof raw === 'string' && raw) {
      const parsed: unknown = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError('metadata must be a JSON object')
      metadata = parsed as Record<string, unknown>
    }
  } catch {
    return NextResponse.json({ error: 'Invalid metadata.' }, { status: 400 })
  }
  const assetId = typeof metadata.assetId === 'string' && metadata.assetId ? metadata.assetId : ''
  if (!assetId) {
    return NextResponse.json({ error: 'Missing assetId.' }, { status: 400 })
  }

  // Only the image is stored here (same as OpenHiggsBolt). The edit's provenance (original asset, operation, prompt)
  // stays with the client's saved project; no `personalization_edited_assets` table exists in either repository.
  // A new object per edit, so a cached earlier edit is never shown in place
  // of a newer one (the client stores whichever URL comes back).
  const objectPath = `${sanitizeSegment(userId)}/edited/${sanitizeSegment(assetId)}/edited-${crypto.randomUUID()}.${EXTENSION[image.type]}`
  try {
    const storage = createServerClient().storage.from(BUCKET)
    const { error } = await storage.upload(objectPath, image, { upsert: true, contentType: image.type })
    if (error) throw new Error(error.message)
    const { data } = storage.getPublicUrl(objectPath)
    const publicUrl = data?.publicUrl || ''
    if (!publicUrl) throw new Error('no public URL for the stored image')

    logPersonalization({ route, stage: 'stored', httpStatus: 200, safeMessage: 'Edited image stored', correlationId })
    return NextResponse.json({
      ok: true,
      assetId,
      publicUrl,
      // The editor already knows whether it produced a transparent image.
      hasTransparency: metadata.transparent === true,
      transparentPixelCount: 0,
      totalPixelCount: 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error'
    logPersonalization({ route, stage: 'storage', httpStatus: 500, safeErrorCode: 'STORAGE_FAILED', safeMessage: message, correlationId })
    return NextResponse.json({ error: "Couldn't save the edited image." }, { status: 500 })
  }
}
