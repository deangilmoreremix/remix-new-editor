'use client'

/**
 * "Results" for the overlay editor (Stage 11): how a published video is doing, and how each personal link was used. Every figure says
 * what it counts; rates show "—" rather than 0% when there is nothing to divide by; nothing is predicted. A PDF report and CSV exports
 * are made in this browser from the same report.
 */
import { useState } from 'react'
import { fetchReport, lastDays, type ReportResult } from '../report/reportClient'
import { ENGAGEMENT_TEXT, dailyCsv, engagementOf, observations, pct, recipientFunnel, recipientsCsv, tiles, type Report } from '../report/reportModel'
import { buildReportPdf } from '../report/reportPdf'
import { parseVideoId } from '../publish/recipientLinksClient'
import { browserDownloadBlob } from './ThumbnailGifPanel'
import { C, chipStyle, hintStyle, inputStyle, labelStyle, softPanelStyle } from './tokens'

export interface ResultsPanelProps {
  initialVideo?: string
  /** Test seams. */
  fetchReportFn?: typeof fetchReport
  downloadFn?: (fileName: string, blob: Blob) => void
  now?: () => Date
}
const small = { ...chipStyle(false), minHeight: 28, fontSize: 10 } as const
const row = { display: 'flex', gap: 6, flexWrap: 'wrap' as const, alignItems: 'center' }
const PERIODS: Array<[number, string]> = [[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last year']]

function DailyChart({ report }: { report: Report }) {
  const days = report.daily; const max = Math.max(4, Math.ceil(Math.max(1, ...days.map((d) => Math.max(d.pageVisits, d.plays))) / 4) * 4)
  const w = 560; const h = 120; const slot = w / Math.max(1, days.length); const bw = Math.max(1, Math.min(10, slot * 0.38))
  const total = days.reduce((n, d) => n + d.pageVisits, 0)
  return (
    <>
      <svg role="img" aria-label={`Visits and plays per day, ${days.length} days, ${total} visits in total. The numbers are in the table below.`} viewBox={`0 0 ${w} ${h + 18}`} style={{ width: '100%', height: 'auto' }}>
        {[0, 0.5, 1].map((t) => <line key={t} x1={0} x2={w} y1={h - t * h} y2={h - t * h} stroke={C.border} />)}
        {days.map((d, i) => { const x = i * slot + slot / 2; return (<g key={d.day}><title>{`${d.day}: ${d.pageVisits} visits, ${d.plays} plays`}</title><rect x={x - bw - 0.5} y={h - (d.pageVisits / max) * h} width={bw} height={(d.pageVisits / max) * h} fill={C.accent} /><rect x={x + 0.5} y={h - (d.plays / max) * h} width={bw} height={(d.plays / max) * h} fill="#f59e0b" /></g>) })}
        {days.filter((_, i) => i % Math.ceil(days.length / 8) === 0).map((d) => <text key={d.day} x={days.indexOf(d) * slot + slot / 2} y={h + 12} fontSize={8} textAnchor="middle" fill={C.muted}>{d.day.slice(5)}</text>)}
      </svg>
      <div style={hintStyle}><span style={{ color: C.accent }}>■</span> Page visits &nbsp; <span style={{ color: '#f59e0b' }}>■</span> Plays</div>
      <details><summary style={hintStyle}>Show the numbers</summary>
        <table style={{ width: '100%', fontSize: 11, color: C.text }}><thead><tr><th align="left">Day</th><th align="right">Visits</th><th align="right">Plays</th><th align="right">Finished</th><th align="right">Clicks</th><th align="right">Forms</th></tr></thead>
          <tbody>{days.map((d) => <tr key={d.day}><td>{d.day}</td><td align="right">{d.pageVisits}</td><td align="right">{d.plays}</td><td align="right">{d.completes}</td><td align="right">{d.ctaClicks}</td><td align="right">{d.leads}</td></tr>)}</tbody></table>
      </details>
    </>
  )
}

export function ResultsPanel({ initialVideo = '', fetchReportFn, downloadFn, now }: ResultsPanelProps) {
  const [address, setAddress] = useState(initialVideo)
  const [days, setDays] = useState(30)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null)
  const dl = downloadFn ?? browserDownloadBlob
  const videoId = parseVideoId(address)

  const load = async () => {
    if (!videoId) { setNote({ text: 'That does not look like a published video address (…/watch/<id>).', bad: true }); return }
    setBusy(true); setNote(null)
    try {
      const res: ReportResult = await (fetchReportFn ?? fetchReport)(videoId, lastDays(days, now?.()))
      if (res.ok) setReport(res.report); else { setReport(null); setNote({ text: res.message, bad: true }) }
    } finally { setBusy(false) }
  }
  const slug = (r: Report) => `results-${r.video.id}-${r.period.to}`
  const pdf = () => {
    if (!report) return; const out = buildReportPdf(report, { now: now?.() })
    dl(`${slug(report)}.pdf`, new Blob([out.bytes as unknown as BlobPart], { type: 'application/pdf' }))
    setNote({ text: out.replacedChars > 0 ? 'Report downloaded. Some characters (for example Chinese or Arabic letters) cannot be shown in a PDF and appear as "?"; the CSV has the full names.' : 'Report downloaded.', bad: out.replacedChars > 0 })
  }
  const funnel = report ? recipientFunnel(report.recipients) : []

  return (
    <div style={{ ...softPanelStyle, display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="results-panel">
      <div style={labelStyle}>Results</div>
      <p style={hintStyle}>How a published video is doing and how each personal link was used. Numbers come from the hosted player; visitors who block analytics are not counted.</p>
      <div style={row}>
        <input aria-label="Published video address for results" placeholder="…/watch/<id>" value={address} onChange={(e) => setAddress(e.target.value)} style={{ ...inputStyle, minHeight: 28, padding: '0 6px', flex: 1, minWidth: 180 }} />
        <select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ ...inputStyle, minHeight: 28 }}>{PERIODS.map(([d, l]) => <option key={d} value={d}>{l}</option>)}</select>
        <button type="button" style={small} disabled={busy || !address.trim()} onClick={() => void load()}>{busy ? 'Loading…' : 'Show results'}</button>
      </div>
      {note ? <div role={note.bad ? 'alert' : 'status'} data-testid="results-note" style={hintStyle}>{note.text}</div> : null}

      {report ? (
        <div data-testid="results-report" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...hintStyle, color: C.text }}><strong>{report.video.title}</strong> · {report.period.from} to {report.period.to}{report.video.published ? '' : ' · not currently published'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 6 }}>
            {tiles(report).map((t) => (<div key={t.id} data-testid={`tile-${t.id}`} style={{ background: C.field, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8 }}><div style={{ ...hintStyle, fontWeight: 600 }}>{t.label}</div><div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>{t.value}</div><div style={{ ...hintStyle, fontSize: 9 }}>{t.note}</div></div>))}
          </div>

          <div style={{ ...hintStyle, color: C.text, fontWeight: 600 }}>What the people you sent it to did</div>
          {funnel[0].count === 0 ? <p style={hintStyle}>No personal links have been made for this video, so there is no per-recipient breakdown.</p> : (
            <div data-testid="results-funnel">{funnel.map((s) => (
              <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 70px', gap: 6, alignItems: 'center', fontSize: 11, color: C.text }}>
                <span>{s.label}</span><div role="meter" aria-label={s.label} aria-valuemin={0} aria-valuemax={funnel[0].count} aria-valuenow={s.count} style={{ background: C.field, height: 10, borderRadius: 5, overflow: 'hidden' }}><div style={{ width: `${(s.ofMade ?? 0) * 100}%`, height: '100%', background: s.id === 'acted' ? '#059669' : C.accent }} /></div><span>{s.count} · {pct(s.ofMade)}</span>
              </div>))}</div>)}

          <div style={{ ...hintStyle, color: C.text, fontWeight: 600 }}>In plain words</div>
          <ul data-testid="results-observations" style={{ margin: 0, paddingLeft: 16, ...hintStyle, color: C.text }}>{observations(report).map((o) => <li key={o}>{o}</li>)}</ul>

          <div style={{ ...hintStyle, color: C.text, fontWeight: 600 }}>Over time</div>
          {report.daily.length === 0 || report.daily.every((d) => d.pageVisits === 0 && d.plays === 0) ? <p style={hintStyle}>No visits were recorded in this period.</p> : <DailyChart report={report} />}

          {report.recipients.length > 0 ? (
            <details open><summary style={{ ...hintStyle, color: C.text, fontWeight: 600 }}>By recipient ({report.recipients.length})</summary>
              <div style={{ maxHeight: 220, overflow: 'auto' }}><table data-testid="results-recipients" style={{ width: '100%', fontSize: 11, color: C.text }}>
                <thead><tr><th align="left">Recipient</th><th align="left">Furthest step</th><th align="right">Opens</th><th align="right">Plays</th><th align="right">Finished</th><th align="right">Clicks</th><th align="right">Forms</th></tr></thead>
                <tbody>{[...report.recipients].sort((a, b) => b.plays - a.plays || b.views - a.views || a.label.localeCompare(b.label)).map((r) => <tr key={r.id}><td>{r.label}{r.status !== 'live' ? ` (${r.status})` : ''}</td><td>{ENGAGEMENT_TEXT[engagementOf(r)]}</td><td align="right">{r.views}</td><td align="right">{r.plays}</td><td align="right">{r.completes}</td><td align="right">{r.ctaClicks}</td><td align="right">{r.leads}</td></tr>)}</tbody></table></div>
            </details>) : null}

          <div style={row}>
            <button type="button" style={small} onClick={pdf}>Download report (.pdf)</button>
            <button type="button" style={small} disabled={report.recipients.length === 0} onClick={() => dl(`${slug(report)}-recipients.csv`, new Blob(['﻿' + recipientsCsv(report)], { type: 'text/csv' }))}>Recipients (.csv)</button>
            <button type="button" style={small} disabled={report.daily.length === 0} onClick={() => dl(`${slug(report)}-daily.csv`, new Blob(['﻿' + dailyCsv(report)], { type: 'text/csv' }))}>Daily numbers (.csv)</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
