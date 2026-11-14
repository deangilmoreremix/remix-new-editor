/**
 * The results report as a PDF (Stage 11). Built entirely in the browser from the same Report the dashboard shows; nothing is uploaded.
 * Every number comes from the report; text that would not fit is shortened with "..." rather than overlapping.
 */
import { ENGAGEMENT_TEXT, REPORT_DEFINITIONS, ctaName, duration, engagementOf, observations, pct, recipientFunnel, tiles, type Report } from './reportModel'
import { PdfDoc, PdfPage, fit, rgb, textWidth } from './pdf'

const INK = rgb('#1f2937'); const MUTED = rgb('#6b7280'); const ACCENT = rgb('#2563eb'); const ACCENT2 = rgb('#f59e0b'); const GREEN = rgb('#059669'); const TRACK = rgb('#e5e7eb'); const PANEL = rgb('#f3f4f6')
const M = 40 // margin
const ROWS_PER_PAGE = 42

export interface ReportPdf { bytes: Uint8Array; pages: number; replacedChars: number }

const fmtDay = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const fmtStamp = (iso: string) => (iso ? iso.replace('T', ' ').slice(0, 16) + ' UTC' : '')

function header(p: PdfPage, r: Report, title: string): number {
  p.rect(0, 0, p.width, 6, { fill: ACCENT })
  p.text(M, 38, title, { size: 18, bold: true, color: INK })
  p.text(M, 56, fit(r.video.title, 11, p.width - 2 * M), { size: 11, color: MUTED })
  p.text(M, 71, `${r.period.from} to ${r.period.to}   ·   Video ${r.video.id}${r.video.published ? '' : '   ·   not currently published'}`, { size: 9, color: MUTED })
  p.line(M, 80, p.width - M, 80)
  return 96
}
function sectionTitle(p: PdfPage, y: number, text: string): number { p.text(M, y, text, { size: 12, bold: true, color: INK }); return y + 16 }

/** Wraps text into lines that fit. */
function wrap(text: string, size: number, width: number, bold = false): string[] {
  const out: string[] = []; let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (textWidth(next, size, bold) <= width) line = next
    else { if (line) out.push(line); line = textWidth(word, size, bold) > width ? fit(word, size, width, bold) : word }
  }
  if (line) out.push(line)
  return out
}

export function buildReportPdf(r: Report, opts: { now?: Date } = {}): ReportPdf {
  const doc = new PdfDoc(); const now = opts.now ?? new Date()
  const W = doc.size.width; const inner = W - 2 * M

  // ═══ page 1: results ═══
  let p = doc.addPage(); let y = header(p, r, 'Video results')
  y = sectionTitle(p, y, 'The numbers')
  const t = tiles(r); const colW = (inner - 12) / 2; const tileH = 64
  t.forEach((tile, i) => {
    const x = M + (i % 2) * (colW + 12); const ty = y + Math.floor(i / 2) * (tileH + 8)
    p.rect(x, ty, colW, tileH, { fill: PANEL })
    p.text(x + 10, ty + 16, tile.label, { size: 9, bold: true, color: MUTED })
    p.text(x + 10, ty + 38, fit(tile.value, 20, colW - 20, true), { size: 20, bold: true, color: INK })
    const lines = wrap(tile.note, 7.5, colW - 20).slice(0, 2); lines.forEach((l, k) => p.text(x + 10, ty + 50 + k * 8.5, l, { size: 7.5, color: MUTED }))
  })
  y += Math.ceil(t.length / 2) * (tileH + 8) + 10

  y = sectionTitle(p, y, 'What the people you sent it to did')
  const funnel = recipientFunnel(r.recipients)
  if (funnel[0].count === 0) { p.text(M, y + 4, 'No personal links have been made for this video, so there is no per-recipient breakdown.', { size: 9, color: MUTED }); y += 22 }
  else {
    const barX = M + 175; const barW = inner - 175 - 70
    funnel.forEach((s, i) => {
      const by = y + i * 22
      p.text(M, by + 9, s.label, { size: 9.5, color: INK })
      p.rect(barX, by, barW, 12, { fill: TRACK }); p.rect(barX, by, barW * (s.ofMade ?? 0), 12, { fill: i === 0 ? MUTED : i === 4 ? GREEN : ACCENT })
      p.text(barX + barW + 8, by + 9.5, `${s.count}`, { size: 9.5, bold: true, color: INK }); p.text(W - M, by + 9.5, pct(s.ofMade), { size: 9, color: MUTED, align: 'right' })
    })
    y += funnel.length * 22 + 8
  }

  y = sectionTitle(p, y, 'In plain words')
  for (const line of observations(r)) { for (const [k, l] of wrap(line, 9.5, inner - 14).entries()) { if (k === 0) p.text(M, y + 8, '•', { size: 9.5, color: ACCENT }); p.text(M + 12, y + 8, l, { size: 9.5, color: INK }); y += 13 } y += 2 }
  y += 6

  // ═══ page 2: over time ═══
  p = doc.addPage(); y = header(p, r, 'Over time'); y = sectionTitle(p, y, 'Visits and plays per day')
  const days = r.daily
  if (days.length === 0 || days.every((d) => d.pageVisits === 0 && d.plays === 0)) { p.text(M, y + 6, 'No visits were recorded in this period.', { size: 9, color: MUTED }); y += 30 }
  else {
    const chartH = 130; const cx = M + 26; const cw = inner - 26; const max = Math.max(4, Math.ceil(Math.max(1, ...days.map((d) => Math.max(d.pageVisits, d.plays))) / 4) * 4) // a multiple of 4, so the half-way tick is a whole number
    const ticks = [0, 0.5, 1]; ticks.forEach((tk) => { const ty = y + chartH - tk * chartH; p.line(cx, ty, cx + cw, ty); p.text(cx - 4, ty + 3, String(Math.round(max * tk)), { size: 7, color: MUTED, align: 'right' }) })
    const slot = cw / days.length; const bw = Math.max(1, Math.min(10, slot * 0.38))
    days.forEach((d, i) => {
      const x = cx + i * slot + slot / 2
      p.rect(x - bw - 0.5, y + chartH - (d.pageVisits / max) * chartH, bw, (d.pageVisits / max) * chartH, { fill: ACCENT })
      p.rect(x + 0.5, y + chartH - (d.plays / max) * chartH, bw, (d.plays / max) * chartH, { fill: ACCENT2 })
      if (i % Math.ceil(days.length / 10) === 0) p.text(x, y + chartH + 11, fmtDay(d.day), { size: 6.5, color: MUTED, align: 'center' })
    })
    y += chartH + 26
    p.rect(M, y - 7, 8, 8, { fill: ACCENT }); p.text(M + 12, y, 'Page visits', { size: 8, color: INK }); p.rect(M + 80, y - 7, 8, 8, { fill: ACCENT2 }); p.text(M + 92, y, 'Plays', { size: 8, color: INK })
    y += 22
  }
  y = sectionTitle(p, y, 'How much of the video people watched')
  const ret = r.retention
  if (ret.length < 2 || !(ret[0].base > 0)) { p.text(M, y + 6, 'Not enough viewing yet to draw this.', { size: 9, color: MUTED }); y += 30 }
  else {
    const chartH = 110; const cx = M + 26; const cw = inner - 26; const base = Math.max(1, ret[0].base)
    ;[0, 0.5, 1].forEach((tk) => { const ty = y + chartH - tk * chartH; p.line(cx, ty, cx + cw, ty); p.text(cx - 4, ty + 3, `${Math.round(tk * 100)}%`, { size: 7, color: MUTED, align: 'right' }) })
    p.polyline(ret.map((b, i) => [cx + (i / (ret.length - 1)) * cw, y + chartH - Math.min(1, b.viewers / base) * chartH] as [number, number]), { color: ACCENT, width: 1.8 })
    p.text(cx, y + chartH + 11, 'start of video', { size: 7, color: MUTED }); p.text(cx + cw, y + chartH + 11, 'end of video', { size: 7, color: MUTED, align: 'right' })
    y += chartH + 24
  }
  if (r.cta.length > 0) {
    y = sectionTitle(p, y, 'Which buttons were used')
    p.text(M, y + 8, 'Button', { size: 8.5, bold: true, color: MUTED }); p.text(W - M - 140, y + 8, 'Visits using it', { size: 8.5, bold: true, color: MUTED, align: 'right' }); p.text(W - M, y + 8, 'Share of those that played', { size: 8.5, bold: true, color: MUTED, align: 'right' }); y += 14
    for (const c of r.cta.slice(0, 10)) { p.text(M, y + 8, fit(ctaName(c), 9, inner - 260), { size: 9, color: INK }); p.text(W - M - 140, y + 8, String(c.sessions), { size: 9, color: INK, align: 'right' }); p.text(W - M, y + 8, c.eligibleSessions > 0 ? pct(c.sessions / c.eligibleSessions) : '—', { size: 9, color: MUTED, align: 'right' }); y += 13 }
  }

  // ═══ recipients table ═══
  const rows = [...r.recipients].sort((a, b) => b.plays - a.plays || b.views - a.views || a.label.localeCompare(b.label))
  const chunks: Array<typeof rows> = []; for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) chunks.push(rows.slice(i, i + ROWS_PER_PAGE))
  chunks.forEach((chunk, ci) => {
    p = doc.addPage(); y = header(p, r, ci === 0 ? 'By recipient' : 'By recipient (continued)')
    const cols = [{ k: 'Recipient', x: M, a: 'left' as const }, { k: 'Furthest step', x: M + 190, a: 'left' as const }, { k: 'Opens', x: M + 340, a: 'right' as const }, { k: 'Plays', x: M + 385, a: 'right' as const }, { k: 'Finished', x: M + 440, a: 'right' as const }, { k: 'Clicks', x: M + 485, a: 'right' as const }, { k: 'Forms', x: W - M, a: 'right' as const }]
    cols.forEach((c) => p.text(c.x, y + 8, c.k, { size: 8.5, bold: true, color: MUTED, align: c.a })); y += 12; p.line(M, y, W - M, y); y += 4
    chunk.forEach((x, i) => {
      if (i % 2 === 1) p.rect(M - 4, y - 1, inner + 8, 12.5, { fill: rgb('#f9fafb') })
      const e = engagementOf(x)
      p.text(M, y + 8, fit(x.label + (x.status !== 'live' ? ` (${x.status})` : ''), 8.5, 180), { size: 8.5, color: INK }); p.text(M + 190, y + 8, ENGAGEMENT_TEXT[e], { size: 8.5, color: e === 'acted' ? GREEN : e === 'not-opened' ? MUTED : INK, bold: e === 'acted' })
      ;[[M + 340, x.views], [M + 385, x.plays], [M + 440, x.completes], [M + 485, x.ctaClicks], [W - M, x.leads]].forEach(([cx, v]) => p.text(cx as number, y + 8, String(v), { size: 8.5, color: INK, align: 'right' })); y += 12.5
    })
  })

  // ═══ how to read this ═══
  p = doc.addPage(); y = header(p, r, 'How to read this report'); y = sectionTitle(p, y, 'What the figures mean')
  for (const d of REPORT_DEFINITIONS) for (const [k, l] of wrap(d, 9.5, inner - 14).entries()) { if (k === 0) p.text(M, y + 8, '•', { size: 9.5, color: ACCENT }); p.text(M + 12, y + 8, l, { size: 9.5, color: INK }); y += 13; if (k === wrap(d, 9.5, inner - 14).length - 1) y += 4 }
  y += 8; y = sectionTitle(p, y, 'About this file')
  p.text(M, y + 8, `Made ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC from data generated ${fmtStamp(r.generatedAt) || 'at the time of download'}.`, { size: 9, color: MUTED })
  if (r.summary.avgWatchSeconds !== null) p.text(M, y + 22, `On average ${duration(r.summary.avgWatchSeconds)} of the video was watched per visit that pressed play.`, { size: 9, color: MUTED })
  if (doc.replacedChars > 0) {
    // the standard PDF fonts cannot show every script: say so on the page instead of leaving unexplained question marks
    const note = 'Some characters (for example Chinese, Japanese or Arabic letters, or emoji) cannot be shown in this PDF and appear as "?". The names are complete in the CSV export.'
    wrap(note, 9, inner, true).forEach((l, k) => p.text(M, y + 44 + k * 12, l, { size: 9, bold: true, color: INK }))
  }

  // footers (page numbers need the final count)
  doc.pages.forEach((pg, i) => { pg.text(M, pg.height - 22, `SmartVideo results · ${fit(r.video.title, 8, 260)}`, { size: 8, color: MUTED }); pg.text(pg.width - M, pg.height - 22, `Page ${i + 1} of ${doc.pages.length}`, { size: 8, color: MUTED, align: 'right' }) })
  const bytes = doc.build({ title: `Video results: ${r.video.title}`, subject: `${r.period.from} to ${r.period.to}`, created: now })
  return { bytes, pages: doc.pages.length, replacedChars: doc.replacedChars }
}
