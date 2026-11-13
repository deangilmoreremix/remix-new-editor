/** Browser client for the outreach TEST send (Stage 9). Never throws; every outcome is a typed result with a message. */
import type { OutreachEmail } from './emailModel'

export const OUTREACH_API = '/api/personalization/outreach'
export type SendFailure = 'unauthenticated' | 'not-configured' | 'not-allowed' | 'suppressed' | 'not-ready' | 'rate-limited' | 'invalid' | 'failed' | 'unavailable'
export type SendResult = { ok: true; messageId: string; note: string } | { ok: false; reason: SendFailure; message: string; checks?: Array<{ id: string; message: string }> }

const MESSAGES: Record<SendFailure, string> = {
  unauthenticated: 'Sign in to send a test email.',
  'not-configured': 'Sending email is not set up on this server yet. You can still download the email as HTML, text or .eml.',
  'not-allowed': 'Test emails can only go to addresses your administrator has approved.',
  suppressed: 'That address has unsubscribed, so it will not be emailed.',
  'not-ready': 'The email is not ready to send. Fix the items marked as errors first.',
  'rate-limited': 'You have sent the most test emails allowed for now. Try again later.',
  invalid: 'That request could not be used. Check the address and the email.',
  failed: 'The mail server did not accept the message. Nothing was sent.',
  unavailable: 'Sending is not available here. You can still download the email.',
}

export async function sendTestEmail(to: string, email: OutreachEmail, values: Record<string, string>, fetchFn: typeof fetch = fetch): Promise<SendResult> {
  let res: { status: number; json: Record<string, any> | null }
  try {
    const r = await fetchFn(OUTREACH_API, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'test', to, email, values }) })
    let json: Record<string, any> | null = null
    try { json = await r.json() } catch { json = null }
    res = { status: r.status, json }
  } catch { return { ok: false, reason: 'unavailable', message: MESSAGES.unavailable } }
  const { status, json } = res
  if (status === 200 && json?.ok === true && typeof json.messageId === 'string') return { ok: true, messageId: json.messageId, note: String(json.note ?? '') }
  const reason: SendFailure = status === 401 ? 'unauthenticated' : status === 503 ? 'not-configured' : status === 403 ? 'not-allowed' : status === 409 ? 'suppressed' : status === 429 ? 'rate-limited' : status === 400 && json?.error === 'EMAIL_NOT_READY' ? 'not-ready' : status === 400 || status === 413 ? 'invalid' : status === 404 || status === 405 || status === 501 ? 'unavailable' : 'failed'
  return { ok: false, reason, message: MESSAGES[reason], ...(reason === 'not-ready' && Array.isArray(json?.checks) ? { checks: json!.checks.map((c: any) => ({ id: String(c.id), message: String(c.message) })) } : {}) }
}
