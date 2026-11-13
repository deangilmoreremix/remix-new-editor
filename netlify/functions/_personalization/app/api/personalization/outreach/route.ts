import { NextRequest, NextResponse } from '../../../../shims/next-server'
import { auth } from '../../../../shims/clerk-server'
import { createServerClient } from '../../../../src/lib/supabase'
import { logPersonalization, createCorrelationId } from '../../../../src/server/personalizationLog'
import { requirePersonalizationEnv } from '../../../../src/server/envValidation'
import { rateLimit, rateLimit429, resolveRateLimitKey } from '../../../../lib/rateLimit'
import { isEmailAddress, mergeEmail, normalizeEmail } from '../../../../../../../src/features/personalization/shared/personalization/email/emailModel'
import { renderEmail } from '../../../../../../../src/features/personalization/shared/personalization/email/renderEmail'
import { hashAddress, listUnsubscribeHeaders, normalizeAddress, signUnsubscribe, unsubscribeUrl } from '../../../../../../../src/features/personalization/shared/personalization/email/unsubscribe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Outreach email TEST send (Stage 9).
 *
 *   POST { mode: 'test', to, email, values? }   -> { ok, messageId, accepted, response, note }
 *
 * What this is NOT: a bulk sender. `mode: 'send'` answers 501 until the owner has chosen how real sends are run (Stage 10 batches).
 * A test goes to ONE address that must be on OUTREACH_TEST_ALLOWLIST (comma separated): this endpoint is signed-in-only and rate
 * limited, but it still must not become a way to mail arbitrary people through the platform's SMTP credentials.
 *
 * Safety properties, all enforced here and not in the browser:
 *   - disabled unless OUTREACH_SEND_ENABLED=true, OUTREACH_SMTP_URL, OUTREACH_FROM_ADDRESS and OUTREACH_UNSUBSCRIBE_SECRET are set (503)
 *   - the visible From address is OUR configured one; the owner's address is only Reply-To (no spoofing through our SMTP)
 *   - blocking content problems (no unsubscribe, no postal address, bad links…) refuse the send (400)
 *   - the unsubscribe link is a SIGNED token minted here; List-Unsubscribe + one-click headers are added
 *   - suppressed addresses are never mailed, tests included (409)
 *   - 5 sends per hour per user
 * The response says what happened honestly: the SMTP server ACCEPTED the message. That is not inbox delivery.
 */
const ROUTE = '/api/personalization/outreach'
const MAX_BODY_BYTES = 64 * 1024

async function guard(req: NextRequest): Promise<{ userId: string; correlationId: string } | Response> {
  const correlationId = createCorrelationId(req)
  const envCheck = requirePersonalizationEnv()
  if (!envCheck.valid) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  return { userId, correlationId }
}

const siteBase = (req: NextRequest): string => {
  const env = process.env as Record<string, string | undefined>
  for (const v of [env.SITE_URL, env.URL, env.VITE_SITE_URL]) { try { if (v && /^https?:\/\//.test(v)) return new URL(v).origin } catch { /* next */ } }
  return new URL(req.url).origin
}

export async function POST(req: NextRequest) {
  const g = await guard(req)
  if (g instanceof Response) return g
  const { userId, correlationId } = g
  const env = process.env as Record<string, string | undefined>
  const secret = env.OUTREACH_UNSUBSCRIBE_SECRET ?? ''
  if (env.OUTREACH_SEND_ENABLED !== 'true' || !env.OUTREACH_SMTP_URL || !env.OUTREACH_FROM_ADDRESS || secret.length < 16) {
    return NextResponse.json({ error: 'NOT_CONFIGURED', message: 'Sending email is not set up on this server.' }, { status: 503 })
  }

  const limit = rateLimit(resolveRateLimitKey(userId, null), { windowMs: 3_600_000, max: 5 })
  if (!limit.allowed) return rateLimit429(limit.retryAfterMs)

  let text: string
  try { text = await req.text() } catch { return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 }) }
  if (text.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 })
  let body: { mode?: unknown; to?: unknown; email?: unknown; values?: unknown }
  try { body = JSON.parse(text) } catch { return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 }) }

  if (body.mode === 'send') return NextResponse.json({ error: 'NOT_IMPLEMENTED', message: 'Sending to a list is not available yet. Use "Send me a test".' }, { status: 501 })
  if (body.mode !== 'test') return NextResponse.json({ error: 'INVALID_MODE' }, { status: 400 })
  const to = normalizeAddress(typeof body.to === 'string' ? body.to : '')
  if (!isEmailAddress(to)) return NextResponse.json({ error: 'INVALID_RECIPIENT' }, { status: 400 })
  const allow = (env.OUTREACH_TEST_ALLOWLIST ?? '').split(',').map(normalizeAddress).filter(Boolean)
  if (!allow.includes(to)) return NextResponse.json({ error: 'TEST_RECIPIENT_NOT_ALLOWED', message: 'Test emails can only go to addresses your administrator has approved.' }, { status: 403 })

  const values: Record<string, string> = {}
  if (body.values && typeof body.values === 'object' && !Array.isArray(body.values)) for (const [k, v] of Object.entries(body.values as Record<string, unknown>).slice(0, 30)) if (/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(k) && typeof v === 'string') values[k] = v.slice(0, 200)

  const hash = await hashAddress(to)
  const sup = await createServerClient().rpc('email_suppression_check', { p_owner: userId, p_hashes: [hash] })
  if (sup.error) {
    logPersonalization({ route: ROUTE, stage: 'suppression', provider: 'supabase', httpStatus: 502, safeErrorCode: 'DB_SUPPRESSION_FAILED', safeMessage: sup.error.message, correlationId })
    return NextResponse.json({ error: 'Could not check the suppression list', correlationId }, { status: 502 })
  }
  if (Array.isArray(sup.data) && sup.data.includes(hash)) return NextResponse.json({ error: 'SUPPRESSED', message: 'This address has unsubscribed and will not be emailed.' }, { status: 409 })

  const token = await signUnsubscribe(secret, { owner: userId, hash })
  const link = unsubscribeUrl(siteBase(req), token)
  const model = mergeEmail({ ...normalizeEmail(body.email), unsubscribeUrl: link }, values)
  const rendered = await renderEmail(model)
  if (rendered.blocked) return NextResponse.json({ error: 'EMAIL_NOT_READY', checks: rendered.checks.filter((c) => c.level === 'error') }, { status: 400 })

  try {
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.createTransport(env.OUTREACH_SMTP_URL as string)
    const from = { name: model.sender.name || 'Outreach', address: env.OUTREACH_FROM_ADDRESS as string }
    const info = await transport.sendMail({
      from, replyTo: model.sender.address, to,
      subject: `[TEST] ${model.subject}`, html: rendered.html, text: rendered.text,
      headers: { ...listUnsubscribeHeaders(link), 'X-Outreach-Test': '1' },
    })
    return NextResponse.json({ ok: true, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected, response: String(info.response ?? '').slice(0, 200), note: 'The mail server accepted the message. That does not prove it reached the inbox: check your inbox and spam folder.' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    logPersonalization({ route: ROUTE, stage: 'smtp', httpStatus: 502, safeErrorCode: 'SMTP_FAILED', safeMessage: String((err as Error)?.message ?? err).slice(0, 200), correlationId })
    return NextResponse.json({ error: 'SEND_FAILED', message: 'The mail server did not accept the message. Nothing was sent.', correlationId }, { status: 502 })
  }
}
