/**
 * POST /api/personalization/persist-edited-asset
 *
 * OpenHiggsBolt's client calls this after "Use Edited Asset" in the image
 * editor, but OpenHiggsBolt never shipped the route. remix implements it:
 * the edited image is stored in the `brand-assets` bucket under the caller's
 * Clerk user id, and its public URL becomes the asset's durable URL.
 */
import { NextResponse } from '../shims/next-server'
import { auth } from '../shims/clerk-server'
import { createServerClient } from '../src/lib/supabase'

const MAX_BYTES = 5 * 1024 * 1024 // stays under Netlify's 6 MB sync payload cap
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp'])

function safeSegment(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value : ''
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  return cleaned || fallback
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Sign in to save edited images.' }, { status: 401 })

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 })
  }

  const image = form.get('image')
  if (!(image instanceof Blob)) return NextResponse.json({ error: 'image is required' }, { status: 400 })
  const type = image.type || 'image/png'
  if (!ALLOWED.has(type)) return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 })
  if (image.size > MAX_BYTES) return NextResponse.json({ error: 'Edited image is too large to save' }, { status: 413 })

  let metadata: Record<string, unknown> = {}
  try {
    metadata = JSON.parse(String(form.get('metadata') || '{}')) || {}
  } catch {
    metadata = {}
  }

  const assetId = safeSegment(metadata.assetId, `edited-${Date.now()}`)
  const ext = type === 'image/jpeg' ? 'jpg' : type === 'image/webp' ? 'webp' : 'png'
  const path = `personalization/${safeSegment(userId, 'user')}/edited/${assetId}-${Date.now()}.${ext}`

  try {
    const supabase = createServerClient()
    const bytes = new Uint8Array(await image.arrayBuffer())
    const { error } = await supabase.storage.from('brand-assets').upload(path, bytes, { contentType: type, upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from('brand-assets').getPublicUrl(path)
    return NextResponse.json({
      ok: true,
      assetId,
      publicUrl: data.publicUrl,
      hasTransparency: metadata.transparent === true,
      transparentPixelCount: 0,
      totalPixelCount: 0,
    })
  } catch (err) {
    console.error('[persist-edited-asset] upload failed:', (err as Error)?.message || err)
    return NextResponse.json({ error: 'Could not save the edited image' }, { status: 502 })
  }
}
