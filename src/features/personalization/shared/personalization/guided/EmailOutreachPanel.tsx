'use client'

/**
 * "Email" tools for the overlay editor (Stage 9): write the outreach email around the personalized GIF/video, see the exact HTML that
 * will be sent (sandboxed preview), get a checklist of what blocks or hurts delivery, download it (HTML, plain text, .eml) and send
 * ONE test to an approved address. Sending to a list is not offered here.
 *
 * The preview and the downloads are rendered by the same React Email template and plain-text builder the server uses.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildEml } from '../email/eml'
import { checkEmail, defaultEmail, isEmailAddress, isSafeUrl, mergeEmail, normalizeEmail, type OutreachEmail } from '../email/emailModel'
import { renderEmail, htmlProblems, type RenderedEmail } from '../email/renderEmail'
import { sendTestEmail, type SendResult } from '../email/outreachClient'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, softPanelStyle } from './tokens'

export interface EmailOutreachPanelProps {
  /** A public https address of the personalized GIF/thumbnail, when known (upload comes with publishing). */
  heroUrl?: string
  /** The recipient's watch page address, when known. */
  videoUrl?: string
  /** Test seams. */
  sendFn?: typeof sendTestEmail
  downloadFn?: (fileName: string, text: string, mime: string) => void
  renderFn?: (e: OutreachEmail) => Promise<RenderedEmail>
}

const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }
const field = { ...inputStyle, minHeight: 28, padding: '0 6px', width: '100%' } as const

function download(fileName: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = fileName; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function EmailOutreachPanel({ heroUrl = '', videoUrl = '', sendFn, downloadFn, renderFn }: EmailOutreachPanelProps) {
  const [email, setEmail] = useState<OutreachEmail>(() => defaultEmail({}, { heroUrl: isSafeUrl(heroUrl) ? heroUrl : undefined, videoUrl: isSafeUrl(videoUrl) ? videoUrl : undefined, unsubscribeUrl: 'https://example.com/unsubscribe' }))
  const [values, setValues] = useState({ firstName: 'Alex', company: 'Acme Roofing' })
  const [bodyText, setBodyText] = useState(email.body.join('\n\n'))
  const [hero, setHero] = useState(heroUrl)
  const [video, setVideo] = useState(videoUrl)
  const [rendered, setRendered] = useState<RenderedEmail | null>(null)
  const [to, setTo] = useState('')
  const [result, setResult] = useState<SendResult | null>(null)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)

  const merged = useMemo(() => mergeEmail(email, values), [email, values])
  useEffect(() => {
    const id = ++seq.current
    void (renderFn ?? renderEmail)(merged).then((r) => { if (id === seq.current) setRendered(r) })
  }, [merged, renderFn])

  const set = (patch: Partial<OutreachEmail>) => setEmail((e) => normalizeEmail({ ...e, ...patch }))
  const setSender = (patch: Partial<OutreachEmail['sender']>) => setEmail((e) => normalizeEmail({ ...e, sender: { ...e.sender, ...patch } }))
  const applyLinks = (h: string, v: string) => setEmail((e) => normalizeEmail({
    ...e,
    hero: isSafeUrl(h) ? { url: h, alt: e.hero?.alt || 'A short personal video for {{company}}', width: e.hero?.width ?? 480, ...(isSafeUrl(v) ? { href: v } : {}) } : undefined,
    cta: isSafeUrl(v) ? { label: e.cta?.label || 'Watch your video', url: v } : undefined, videoUrl: isSafeUrl(v) ? v : undefined,
  }))
  const checks = rendered?.checks ?? checkEmail(merged)
  const errors = checks.filter((c) => c.level === 'error')
  const problems = rendered ? htmlProblems(rendered.html) : []
  const dl = downloadFn ?? download

  const save = (kind: 'html' | 'txt' | 'eml') => {
    if (!rendered) return
    if (kind === 'html') dl('email.html', rendered.html, 'text/html')
    else if (kind === 'txt') dl('email.txt', rendered.text, 'text/plain')
    else dl('email.eml', buildEml({ from: { name: merged.sender.name, address: merged.sender.address || 'sender@example.com' }, to: to || 'recipient@example.com', subject: merged.subject, html: rendered.html, text: rendered.text, headers: { 'List-Unsubscribe': `<${merged.unsubscribeUrl}>` } }), 'message/rfc822')
  }
  const sendTest = async () => {
    setBusy(true); setResult(null)
    try { setResult(await (sendFn ?? sendTestEmail)(to, email, values)) } finally { setBusy(false) }
  }

  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="email-outreach-panel">
      <div style={labelStyle}>Outreach email</div>
      <p style={hintStyle}>The email around your personalized video. Use {'{{firstName}}'} and {'{{company}}'}; they are filled in per recipient. The unsubscribe link is added for each person when the email is sent.</p>

      <input aria-label="Subject" placeholder="Subject" value={email.subject} onChange={(e) => set({ subject: e.target.value })} style={field} />
      <input aria-label="Preview line" placeholder="Preview line (shown after the subject)" value={email.preheader} onChange={(e) => set({ preheader: e.target.value })} style={field} />
      <input aria-label="Greeting" placeholder="Greeting" value={email.greeting} onChange={(e) => set({ greeting: e.target.value })} style={field} />
      <textarea aria-label="Email text" rows={5} value={bodyText} onChange={(e) => { setBodyText(e.target.value); set({ body: e.target.value.split(/\n{2,}/) }) }} style={{ ...field, padding: 6 }} />
      <div style={row}>
        <input aria-label="GIF or picture address" placeholder="https://… (public address of the GIF)" value={hero} onChange={(e) => { setHero(e.target.value); applyLinks(e.target.value, video) }} style={{ ...field, flex: 1, minWidth: 160, width: 'auto' }} />
        <input aria-label="Video page address" placeholder="https://…/watch/…?r=…" value={video} onChange={(e) => { setVideo(e.target.value); applyLinks(hero, e.target.value) }} style={{ ...field, flex: 1, minWidth: 160, width: 'auto' }} />
      </div>
      {email.cta ? <input aria-label="Button text" value={email.cta.label} onChange={(e) => set({ cta: { ...email.cta!, label: e.target.value } })} style={field} /> : null}
      <div style={row}>
        <input aria-label="Sender name" placeholder="Your name or business" value={email.sender.name} onChange={(e) => setSender({ name: e.target.value })} style={{ ...field, flex: 1, minWidth: 130, width: 'auto' }} />
        <input aria-label="Reply-to email" placeholder="you@yourbusiness.com" value={email.sender.address} onChange={(e) => setSender({ address: e.target.value })} style={{ ...field, flex: 1, minWidth: 130, width: 'auto' }} />
      </div>
      <input aria-label="Postal address" placeholder="Postal address (required in the footer)" value={email.sender.postalAddress} onChange={(e) => setSender({ postalAddress: e.target.value })} style={field} />
      <div style={row}>
        <label style={hintStyle}>Preview as</label>
        <input aria-label="Sample first name" value={values.firstName} onChange={(e) => setValues((v) => ({ ...v, firstName: e.target.value }))} style={{ ...field, width: 110 }} />
        <input aria-label="Sample company" value={values.company} onChange={(e) => setValues((v) => ({ ...v, company: e.target.value }))} style={{ ...field, width: 150 }} />
      </div>

      <div data-testid="email-checks" aria-label="Email checklist">
        {checks.length === 0 ? <p style={{ ...hintStyle, color: C.text }}>Nothing to fix: the checks pass.</p> : checks.map((c) => <div key={c.id} data-level={c.level} style={{ ...hintStyle, color: C.text }}>{c.level === 'error' ? '✖ ' : '⚠ '}{c.message}</div>)}
        {problems.map((p) => <div key={p} data-level="error" style={{ ...hintStyle, color: C.text }}>✖ The generated HTML {p}.</div>)}
      </div>

      {rendered ? <iframe title="Email preview" sandbox="" srcDoc={rendered.html} style={{ width: '100%', height: 420, border: `1px solid ${C.border}`, borderRadius: 8, background: '#fff' }} /> : <p style={hintStyle}>Preparing the preview…</p>}
      {rendered ? <p style={hintStyle} data-testid="email-size">{(rendered.htmlBytes / 1024).toFixed(1)} KB of HTML.</p> : null}

      <div style={row}>
        <button type="button" style={small} disabled={!rendered} onClick={() => save('html')}>Download HTML</button>
        <button type="button" style={small} disabled={!rendered} onClick={() => save('txt')}>Download text</button>
        <button type="button" style={small} disabled={!rendered} onClick={() => save('eml')}>Download .eml</button>
      </div>
      <div style={row}>
        <input aria-label="Send the test to" type="email" placeholder="your@address.com" value={to} onChange={(e) => setTo(e.target.value)} style={{ ...field, flex: 1, minWidth: 160, width: 'auto' }} />
        <button type="button" style={small} disabled={busy || !isEmailAddress(to) || errors.length > 0} title={errors.length ? 'Fix the errors above first' : ''} onClick={sendTest}>{busy ? 'Sending…' : 'Send me a test'}</button>
      </div>
      {result ? (
        <div role={result.ok ? 'status' : 'alert'} data-testid="email-send-result" style={hintStyle}>
          {result.ok ? `Accepted by the mail server (id ${result.messageId}). ${result.note}` : result.message}
          {!result.ok && result.checks?.map((c) => <div key={c.id}>• {c.message}</div>)}
        </div>
      ) : null}
      <p style={hintStyle}>A test goes to one approved address only. Sending to a list is not part of this panel. "Accepted by the mail server" is not the same as "arrived in the inbox".</p>
    </div>
  )
}
