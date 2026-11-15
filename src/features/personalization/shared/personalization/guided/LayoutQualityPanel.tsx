'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Eye, HelpCircle, Loader2, Wand2 } from 'lucide-react'
import { Tip } from './editor/Tip'
import { C, badgeStyle, hintStyle, panelStyle, secondaryButtonStyle } from './tokens'
import type { LayoutQualityState } from './useLayoutQuality'
import type { QualityIssue, QualityStatus } from '../preview/placement'
import type { PreviewLayer } from '../preview/types'

const STATUS: Record<QualityStatus, { label: string; tone: 'green' | 'cyan' | 'muted'; color: string; text: string }> = {
  ready: { label: 'Ready', tone: 'green', color: C.green, text: 'Every check that could run passed.' },
  'needs-adjustment': { label: 'Needs adjustment', tone: 'cyan', color: '#fcd34d', text: 'A layout problem was found. You can still export if the layout is intentional.' },
  'review-required': { label: 'Review required', tone: 'muted', color: C.cyan, text: 'Some things cannot be checked automatically. Look at the preview before you approve.' },
}

function clock(t: number | undefined): string {
  if (typeof t !== 'number' || !Number.isFinite(t)) return ''
  const m = Math.floor(t / 60)
  return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}`
}

function when(i: QualityIssue): string {
  if (i.tStart == null) return ''
  const a = clock(i.tStart)
  const b = clock(i.tEnd)
  return b && b !== a ? `${a}–${b}` : a
}

const LABEL: Partial<Record<PreviewLayer['kind'], string>> = {
  businessName: 'Business name', headline: 'Headline', tagline: 'Tagline', offer: 'Offer', cta: 'Call to action',
  logo: 'Logo', productImage: 'Product image', serviceImage: 'Service image', endCard: 'End card', design: 'Design',
}

/**
 * Layout Quality Check. Says plainly what was and was not verified. A passing
 * check never implies the footage was understood; "Review required" is shown
 * whenever something (subject area, readability, baked-in graphics, rights)
 * could not be verified. Only a confirmed critical rendering failure blocks export.
 */
export function LayoutQualityPanel({ quality, layers, compact = false }: { quality: LayoutQualityState; layers: PreviewLayer[]; compact?: boolean }): React.JSX.Element {
  return compact ? <LayoutQualityBar quality={quality} layers={layers} /> : <FullPanel quality={quality} layers={layers} />
}

/**
 * Compact one-line summary that sits directly under the video stage so the
 * check is visible without scrolling. "Review" expands the full panel (every
 * issue, Show/Fix, subject marking). It opens by itself when export is blocked.
 */
function LayoutQualityBar({ quality, layers }: { quality: LayoutQualityState; layers: PreviewLayer[] }): React.JSX.Element {
  const { report } = quality
  const s = STATUS[report.status]
  const [open, setOpen] = useState(report.blocksExport)
  const adjust = report.issues.filter((i) => i.severity !== 'review').length
  const review = report.issues.filter((i) => i.severity === 'review').length
  const fixable = report.issues.some((i) => i.fixable && i.layerId)
  const Icon = report.status === 'ready' ? CheckCircle2 : report.status === 'needs-adjustment' ? AlertTriangle : HelpCircle
  const first = report.issues[0]
  return (
    <div data-testid="layout-quality-bar" data-status={report.status} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ ...panelStyle, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 12px', border: `1px solid ${report.blocksExport ? C.danger : C.border}` }}>
        <Icon size={15} color={s.color} />
        <div style={{ minWidth: 0, flex: '1 1 200px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>
              Layout check{adjust > 0 ? ` · ${adjust} to fix` : review > 0 ? ` · ${review} to review` : ''}
            </span>
            <span data-testid="layout-quality-bar-status" data-status={report.status} style={badgeStyle(s.tone)}>{s.label}</span>
          </div>
          <div style={{ ...hintStyle, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {first ? first.message : s.text}
          </div>
        </div>
        <Tip id="qualityReview">
        <button type="button" data-testid="layout-quality-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}
          style={{ ...secondaryButtonStyle, minHeight: 30, padding: '0 10px', fontSize: 11 }}>
          {open ? 'Hide details' : 'Review'}
        </button>
        </Tip>
        {fixable && (
          <Tip id="qualityFixAll">
          <button type="button" data-testid="layout-quality-fix-all" onClick={() => quality.applyRecommended()}
            style={{ ...secondaryButtonStyle, minHeight: 30, padding: '0 12px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4, color: C.cyan, borderColor: C.cyan }}>
            <Wand2 size={12} /> Fix all
          </button>
          </Tip>
        )}
      </div>
      {open && <FullPanel quality={quality} layers={layers} />}
    </div>
  )
}

function FullPanel({ quality, layers }: { quality: LayoutQualityState; layers: PreviewLayer[] }): React.JSX.Element {
  const { report, sampling } = quality
  const s = STATUS[report.status]
  const layerName = (id?: string) => {
    const l = layers.find((x) => x.id === id)
    return l ? LABEL[l.kind] ?? l.kind : ''
  }
  return (
    <div data-testid="layout-quality-panel" style={{ ...panelStyle, border: `1px solid ${report.blocksExport ? C.danger : C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        {report.status === 'ready' ? <CheckCircle2 size={15} color={s.color} /> : report.status === 'needs-adjustment' ? <AlertTriangle size={15} color={s.color} /> : <HelpCircle size={15} color={s.color} />}
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: C.text }}>Layout quality check</h3>
        <span data-testid="layout-quality-status" data-status={report.status} style={badgeStyle(s.tone)}>{s.label}</span>
        {report.blocksExport && <span data-testid="layout-quality-blocks" style={{ ...badgeStyle('muted'), color: C.danger, borderColor: C.danger }}>Blocks export</span>}
      </div>
      <p style={{ ...hintStyle, marginBottom: 8 }}>{s.text}</p>
      <p data-testid="layout-quality-scope" style={{ ...hintStyle, marginBottom: 10 }}>
        {sampling === 'measuring' && <><Loader2 size={11} className="animate-spin" style={{ display: 'inline', marginRight: 4 }} />Measuring readability on your footage… </>}
        {sampling === 'done' && `Readability measured on ${report.analysis.frameSamples} frames. `}
        {sampling === 'unavailable' && 'Readability could not be measured on this footage in your browser. '}
        {report.analysis.subjectVerified ? `Checked against ${report.analysis.protectedZones} marked area${report.analysis.protectedZones === 1 ? '' : 's'}.` : 'No subject area is marked, so overlays are not checked against the subject.'}
      </p>

      {report.issues.length > 0 && (
        <ul data-testid="layout-quality-issues" style={{ listStyle: 'none', margin: '0 0 10px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {report.issues.map((i, n) => (
            <li key={`${i.code}-${i.layerId ?? 'x'}-${n}`} data-code={i.code} data-severity={i.severity}
              style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 9px', borderRadius: 8, background: 'rgba(255,255,255,.03)', border: `1px solid ${i.severity === 'critical' ? C.danger : C.border}` }}>
              <span style={{ ...badgeStyle(i.severity === 'review' ? 'muted' : 'cyan'), flexShrink: 0, ...(i.severity === 'critical' ? { color: C.danger, borderColor: C.danger } : {}) }}>
                {i.severity === 'critical' ? 'Critical' : i.severity === 'adjust' ? 'Adjust' : 'Review'}
              </span>
              <span style={{ flex: 1, fontSize: 12, color: C.text, lineHeight: 1.4 }}>
                {i.message}
                {(i.layerId || i.tStart != null) && (
                  <span style={{ color: C.muted, marginLeft: 6 }}>
                    {layerName(i.layerId)}{when(i) ? ` · ${when(i)} s` : ''}
                  </span>
                )}
              </span>
              {(i.layerId || i.tStart != null) && (
                <button type="button" data-testid="layout-quality-show" onClick={() => quality.show(i.layerId, i.tStart)} style={{ ...secondaryButtonStyle, minHeight: 28, padding: '0 10px', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Eye size={11} /> Show
                </button>
              )}
              {i.fixable && i.layerId && (
                <button type="button" data-testid="layout-quality-fix" onClick={() => quality.applyRecommended(i.layerId)} style={{ ...secondaryButtonStyle, minHeight: 28, padding: '0 10px', fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Wand2 size={11} /> Fix
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {report.notes.map((n) => (
        <p key={n} data-testid="layout-quality-note" style={{ ...hintStyle, marginBottom: 8 }}>{n}</p>
      ))}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" data-testid="layout-quality-apply" onClick={() => quality.applyRecommended()} style={{ ...secondaryButtonStyle, minHeight: 32, fontSize: 11 }}>
          Apply recommended placement
        </button>
        <button type="button" data-testid="layout-quality-restore" onClick={() => quality.restoreRecommended()} style={{ ...secondaryButtonStyle, minHeight: 32, fontSize: 11 }}>
          Restore recommended placement
        </button>
        <span style={{ ...hintStyle, marginLeft: 6 }}>Where is the subject?</span>
        {(['left', 'center', 'right'] as const).map((w) => (
          <button key={w} type="button" data-testid={`layout-quality-subject-${w}`} onClick={() => quality.markSubject(w)} style={{ ...secondaryButtonStyle, minHeight: 28, padding: '0 10px', fontSize: 10, textTransform: 'capitalize' }}>{w}</button>
        ))}
        <button type="button" data-testid="layout-quality-subject-clear" onClick={() => quality.markSubject('clear')} style={{ ...secondaryButtonStyle, minHeight: 28, padding: '0 10px', fontSize: 10 }}>Clear</button>
      </div>
      <p style={{ ...hintStyle, marginTop: 8 }}>
        Recommendations never move a layer you placed by hand or locked; “Restore” replaces hand placement (locked layers stay).
      </p>
    </div>
  )
}
