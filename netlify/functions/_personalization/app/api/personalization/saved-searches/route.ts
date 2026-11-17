import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { mapRpcError, validateSavedSearch, validateUuid } from '../../../../src/server/finderContinuity/validate'
import { readJson, withFinderUser } from '../../../../src/server/finderContinuity/withFinderUser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ROUTE = '/api/personalization/saved-searches'

/** The caller's saved Business Finder searches (newest first, at most 25). */
export async function GET(req: NextRequest) {
  return withFinderUser(req, ROUTE, { writes: false }, async ({ userId, supabase, log, correlationId }) => {
    const { data, error } = await supabase.rpc('finder_saved_searches_list', { p_clerk_user_id: userId })
    if (error) {
      const m = mapRpcError(error)
      log('db-list', m.status, m.code, error.message)
      return NextResponse.json({ error: m.message, code: m.code, correlationId }, { status: m.status })
    }
    log('db-list', 200)
    return NextResponse.json({ ok: true, searches: data ?? [] })
  })
}

/** Saves (or updates, by name) one search. Max 25 per user. */
export async function POST(req: NextRequest) {
  return withFinderUser(req, ROUTE, { writes: true }, async ({ userId, supabase, log, correlationId }) => {
    const parsed = await readJson(req)
    if (!parsed.ok) {
      log('parse-body', 400, 'INVALID_JSON', 'Invalid JSON body')
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const v = validateSavedSearch(parsed.body)
    if (!v.ok) {
      log('validate', 400, 'INVALID_BODY', v.error)
      return NextResponse.json({ error: v.error }, { status: 400 })
    }
    const { data, error } = await supabase.rpc('finder_saved_searches_save', {
      p_clerk_user_id: userId, p_name: v.value.name, p_niche: v.value.niche, p_location: v.value.location,
      p_radius_miles: v.value.radiusMiles, p_include_chains: v.value.includeChains,
    })
    if (error) {
      const m = mapRpcError(error)
      log('db-save', m.status, m.code, error.message)
      return NextResponse.json({ error: m.message, code: m.code, correlationId }, { status: m.status })
    }
    log('db-save', 200)
    return NextResponse.json({ ok: true, search: data })
  })
}

/** Deletes one of the caller's saved searches: DELETE ?id=<uuid>. */
export async function DELETE(req: NextRequest) {
  return withFinderUser(req, ROUTE, { writes: true }, async ({ userId, supabase, log, correlationId }) => {
    const id = validateUuid(new URL(req.url).searchParams.get('id'))
    if (!id) {
      log('validate', 400, 'INVALID_ID', 'id must be a UUID')
      return NextResponse.json({ error: 'id must be a UUID' }, { status: 400 })
    }
    const { data, error } = await supabase.rpc('finder_saved_searches_delete', { p_clerk_user_id: userId, p_id: id })
    if (error) {
      const m = mapRpcError(error)
      log('db-delete', m.status, m.code, error.message)
      return NextResponse.json({ error: m.message, code: m.code, correlationId }, { status: m.status })
    }
    if (!data) {
      log('db-delete', 404, 'NOT_FOUND')
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    log('db-delete', 200)
    return NextResponse.json({ ok: true })
  })
}
