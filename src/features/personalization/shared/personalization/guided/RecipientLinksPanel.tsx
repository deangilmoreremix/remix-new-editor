'use client'

/**
 * "Personal links" for the overlay editor (Stage 8): make an unguessable link per recipient for a PUBLISHED video, copy or download
 * them, see who watched and clicked, and revoke a link. The links are made by the server; their tokens are shown ONCE (only a hash is
 * stored), so the panel says so and offers a CSV download straight away.
 */
import { useRef, useState } from 'react'
import { buildRecipientUrl, isRecipientToken, linksToCsv, planLabels } from '../publish/recipientToken'
import {
  issueRecipientLinks, listRecipientLinks, parseVideoId, revokeRecipientLink, type IssuedLink, type LinksResult, type RecipientLink,
} from '../publish/recipientLinksClient'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, softPanelStyle } from './tokens'

export interface RecipientLinksPanelProps {
  /** A video already published from the account (id or watch address), when known. */
  initialVideo?: string
  /** The site origin used to build the links the server returned (defaults to this page's). */
  origin?: string
  /** Test seams. */
  fetchFn?: typeof fetch
  copyFn?: (text: string) => Promise<void> | void
  downloadFn?: (fileName: string, text: string, mime: string) => void
}

const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }

async function defaultCopy(text: string) { await navigator.clipboard.writeText(text) }
function defaultDownload(fileName: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = fileName; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export function RecipientLinksPanel({ initialVideo = '', origin, fetchFn, copyFn, downloadFn }: RecipientLinksPanelProps) {
  const [video, setVideo] = useState(initialVideo)
  const [names, setNames] = useState('')
  const [days, setDays] = useState<number | ''>('')
  const [links, setLinks] = useState<RecipientLink[] | null>(null)
  const [fresh, setFresh] = useState<IssuedLink[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const reqId = useRef(0)
  const videoId = parseVideoId(video)
  const base = origin ?? (typeof location !== 'undefined' ? location.origin : 'https://example.com')
  const f = fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  // Blank lines are just spacing, not mistakes: only real entries are checked.
  const plan = planLabels(names.split(/\r?\n|,/).filter((s) => s.trim() !== ''))

  const report = <T,>(r: LinksResult<T>, ok?: string): r is { ok: true; data: T } => {
    if (r.ok) { setIsError(false); setMessage(ok ?? ''); return true }
    setIsError(true); setMessage(r.message); return false
  }

  const refresh = async () => {
    if (!videoId) return
    const id = ++reqId.current
    const r = await listRecipientLinks(videoId, f)
    if (id !== reqId.current) return
    // A successful refresh must not wipe the message of the action that triggered it ("Made 2 links…", "Revoked…").
    if (r.ok) setLinks(r.data); else report(r)
  }
  const create = async () => {
    if (!videoId || busy) return
    setBusy(true); setMessage(''); setFresh(null)
    try {
      const r = await issueRecipientLinks(videoId, plan.labels, { expiresInDays: days === '' ? null : days }, f)
      if (!report(r, `Made ${plan.labels.length} link${plan.labels.length === 1 ? '' : 's'}. Copy or download them now: they cannot be shown again.`)) return
      // Rebuild each URL from the token with THIS site's address, so a server behind a proxy still hands out working links.
      const issued = r.data.map((l) => (isRecipientToken(l.token) ? { ...l, url: buildRecipientUrl(base, videoId, l.token) } : l))
      setFresh(issued); setNames(''); void refresh()
    } finally { setBusy(false) }
  }
  const revoke = async (l: RecipientLink) => {
    const r = await revokeRecipientLink(l.id, f)
    if (report(r, `Revoked the link for ${l.label}. It stops working immediately.`)) void refresh()
  }
  const csv = () => (downloadFn ?? defaultDownload)('personal-links.csv', linksToCsv((fresh ?? []).map((l) => ({ label: l.label, url: l.url }))), 'text/csv')

  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="recipient-links-panel">
      <div style={labelStyle}>Personal links</div>
      <p style={hintStyle}>Each recipient gets their own unguessable link to a published video, so you can see who watched, clicked and replied. Nobody can invent or change a link.</p>
      <div style={row}>
        <label style={hintStyle} htmlFor="rl-video">Published video address</label>
        <input id="rl-video" type="text" aria-label="Published video address" placeholder="https://…/watch/abc123xyz" value={video} onChange={(e) => setVideo(e.target.value)} style={{ ...inputStyle, minHeight: 28, padding: '0 6px', flex: 1, minWidth: 180 }} />
        <button type="button" style={small} disabled={!videoId} onClick={() => void refresh()}>Show links</button>
      </div>
      {video && !videoId ? <p role="status" style={hintStyle}>That does not look like a video address. Paste the watch page address of a published video.</p> : null}

      <div>
        <label style={labelStyle} htmlFor="rl-names">Recipients (one name per line)</label>
        <textarea id="rl-names" aria-label="Recipient names" rows={4} value={names} onChange={(e) => setNames(e.target.value)} placeholder={'Acme Roofing\nBright Plumbing'} style={{ ...inputStyle, width: '100%', padding: 6 }} />
        {plan.problems.length ? <p role="status" data-testid="rl-problems" style={hintStyle}>Skipping: {plan.problems.map((p) => `"${p.label}" (${p.reason === 'duplicate' ? 'repeated' : p.reason === 'empty' ? 'empty' : 'too long'})`).join(', ')}</p> : null}
        <div style={row}>
          <label style={hintStyle} htmlFor="rl-days">Expire after (days, optional)</label>
          <input id="rl-days" type="number" aria-label="Expire after days" min={1} max={730} value={days} onChange={(e) => setDays(e.target.value === '' ? '' : Number(e.target.value))} style={{ ...inputStyle, width: 70, minHeight: 28, padding: '0 6px' }} />
          <button type="button" style={small} disabled={!videoId || plan.labels.length === 0 || busy} onClick={create}>{busy ? 'Making…' : `Make ${plan.labels.length || ''} link${plan.labels.length === 1 ? '' : 's'}`}</button>
        </div>
      </div>

      {message ? <div role={isError ? 'alert' : 'status'} data-testid="rl-message" style={hintStyle}>{message}</div> : null}

      {fresh ? (
        <div data-testid="rl-fresh" style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={labelStyle}>New links (shown once)</div>
          {fresh.map((l) => (
            <div key={l.id} style={row}>
              <span style={{ ...hintStyle, minWidth: 110 }}>{l.label}</span>
              <input readOnly aria-label={`Link for ${l.label}`} value={l.url} style={{ ...inputStyle, minHeight: 26, padding: '0 6px', flex: 1, minWidth: 160 }} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" style={small} onClick={() => void (copyFn ?? defaultCopy)(l.url)}>Copy</button>
            </div>
          ))}
          <div style={row}><button type="button" style={small} onClick={csv}>Download all as CSV</button><button type="button" style={small} onClick={() => setFresh(null)}>I have saved them</button></div>
        </div>
      ) : null}

      {links ? (
        <div data-testid="rl-list">
          <div style={labelStyle}>Links for this video ({links.length})</div>
          {links.length === 0 ? <p style={hintStyle}>No links yet.</p> : null}
          {links.map((l) => (
            <div key={l.id} data-testid="rl-row" data-status={l.status} style={{ ...row, borderBottom: `1px solid ${C.border}`, padding: '4px 0' }}>
              <span style={{ ...hintStyle, minWidth: 110, color: C.text }}>{l.label}</span>
              <span style={hintStyle}>{l.status === 'live' ? 'Live' : l.status === 'revoked' ? 'Revoked' : 'Expired'} · {l.views} view{l.views === 1 ? '' : 's'} · {l.plays} play{l.plays === 1 ? '' : 's'} · {l.ctaClicks} click{l.ctaClicks === 1 ? '' : 's'} · {l.leads} repl{l.leads === 1 ? 'y' : 'ies'}{l.lastSeen ? ` · last seen ${new Date(l.lastSeen).toLocaleDateString()}` : ''}</span>
              {l.status === 'live' ? <button type="button" aria-label={`Revoke the link for ${l.label}`} style={small} onClick={() => void revoke(l)}>Revoke</button> : null}
            </div>
          ))}
          <p style={hintStyle}>A link's address cannot be shown again. To replace one, revoke it and make a new one. The address contains a private key: send it only to that recipient, and note that anyone who has it can open the video.</p>
        </div>
      ) : null}
    </div>
  )
}
