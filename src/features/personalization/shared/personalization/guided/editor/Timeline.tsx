'use client'

import { useCallback, useEffect, useRef } from 'react'
import { C, hintStyle } from '../tokens'
import { Tip } from './Tip'
import {
  applyTimelineEdit, formatSeconds, fractionToFrame, frameToFraction, layerSpan, rulerTicks, type TimelineEdit,
} from './timeline'
import type { PreviewLayer } from '../../preview/types'

/**
 * When each layer is on screen: one bar per layer under the video. Drag a bar to move it, drag an edge to trim
 * it; the keyboard works too (arrow keys move one frame, Shift ten). Replaces typing "Shown from (seconds)".
 */
export function Timeline({
  layers,
  labels,
  durationInFrames,
  fps,
  selectedId,
  onSelect,
  onChange,
  playheadFrame,
  onSeek,
}: {
  layers: PreviewLayer[]
  labels: Record<string, string>
  durationInFrames: number
  fps: number
  selectedId: string
  onSelect: (id: string) => void
  onChange: (layerId: string, patch: { startFrame: number; endFrame: number | undefined }) => void
  /** Where the live preview is now; draws a playhead on every track. */
  playheadFrame?: number
  /** When given, clicking or dragging the ruler seeks the preview. */
  onSeek?: (frame: number) => void
}): React.JSX.Element | null {
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; part: TimelineEdit; startX: number; origin: Pick<PreviewLayer, 'startFrame' | 'endFrame'>; pointerId: number | null } | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const duration = Math.max(1, Math.round(durationInFrames))

  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current
    const track = trackRef.current
    if (!d || !track) return
    if (d.pointerId !== null && e.pointerId !== d.pointerId) return
    const width = track.getBoundingClientRect().width
    if (width <= 0) return
    const deltaFrames = ((e.clientX - d.startX) / width) * (duration - 1)
    onChangeRef.current(d.id, applyTimelineEdit(d.origin, d.part, deltaFrames, duration))
  }, [duration])
  const onUp = useCallback(() => { drag.current = null }, [])
  useEffect(() => {
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp) }
  }, [onMove, onUp])

  const rows = layers.filter((l) => l.kind !== 'endCard' && l.visible)
  if (rows.length === 0 || duration < 2) return null
  const ticks = rulerTicks(duration, fps)

  const begin = (e: React.PointerEvent, layer: PreviewLayer, part: TimelineEdit) => {
    e.preventDefault(); e.stopPropagation()
    onSelect(layer.id)
    drag.current = { id: layer.id, part, startX: e.clientX, origin: { startFrame: layer.startFrame, endFrame: layer.endFrame }, pointerId: typeof e.pointerId === 'number' ? e.pointerId : null }
  }
  const key = (e: React.KeyboardEvent, layer: PreviewLayer, part: TimelineEdit) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    onSelect(layer.id)
    const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowLeft' ? -1 : 1)
    onChange(layer.id, applyTimelineEdit(layer, part, step, duration))
  }

  const handle: React.CSSProperties = { position: 'absolute', top: 0, bottom: 0, width: 8, padding: 0, border: 'none', background: 'rgba(255,255,255,.55)', cursor: 'ew-resize', zIndex: 2, touchAction: 'none' }

  return (
    <div data-testid="timeline" role="group" aria-label="Timeline" style={{ display: 'flex', flexDirection: 'column', gap: 4, border: `1px solid ${C.border}`, borderRadius: 12, padding: '8px 10px', background: C.panelSoft }}>
      <div style={{ ...hintStyle, margin: 0, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 800, color: C.text, textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 10 }}>Timeline</span>
        <span>Drag a bar to retime it · drag an edge to trim</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', columnGap: 8, rowGap: 4, alignItems: 'center' }}>
        <span />
        <div ref={trackRef} aria-hidden data-testid="timeline-ruler" style={{ position: 'relative', height: 14, cursor: onSeek ? 'pointer' : undefined }}
          onPointerDown={onSeek ? (e) => { const r = e.currentTarget.getBoundingClientRect(); if (r.width > 0) onSeek(fractionToFrame((e.clientX - r.left) / r.width, duration)) } : undefined}>
          {ticks.map((f) => (
            <span key={f} style={{ position: 'absolute', left: `${frameToFraction(f, duration) * 100}%`, fontSize: 9, color: C.muted2, transform: 'translateX(-1px)' }}>
              {Math.round(f / Math.max(1, fps))}s
            </span>
          ))}
          {playheadFrame !== undefined && <div aria-hidden data-testid="timeline-playhead" style={{ position: 'absolute', top: 0, bottom: 0, left: `${frameToFraction(playheadFrame, duration) * 100}%`, width: 2, marginLeft: -1, background: '#ff4fd8', pointerEvents: 'none', zIndex: 3 }} />}
        </div>
        {rows.map((layer) => {
          const { start, end } = layerSpan(layer, duration)
          const left = frameToFraction(start, duration) * 100
          const width = Math.max(1.5, (frameToFraction(end, duration) - frameToFraction(start, duration)) * 100)
          const selected = layer.id === selectedId
          const name = labels[layer.id] ?? layer.kind
          return (
            <div key={layer.id} style={{ display: 'contents' }}>
              {/* A label, not a button: layer selection for keyboard and screen-reader users is the layers list and the bar's own controls (they select on use). */}
              <span data-testid="timeline-label" onClick={() => onSelect(layer.id)}
                style={{ color: selected ? C.cyan : C.text, fontSize: 11, fontWeight: 700, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </span>
              <div data-testid="timeline-track" style={{ position: 'relative', height: 22, background: 'rgba(255,255,255,.04)', borderRadius: 6 }}>
                <div data-testid="timeline-bar" data-layer-id={layer.id} data-start={start} data-end={layer.endFrame === undefined ? '' : end}
                  style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${width}%`, borderRadius: 6, background: selected ? C.cyanSoft : 'rgba(255,255,255,.12)', border: `1px solid ${selected ? C.cyan : C.borderStrong}`, boxSizing: 'border-box', overflow: 'hidden' }}>
                  <button type="button" role="slider" aria-label={`${name} starts at ${formatSeconds(start, fps)}`} aria-valuemin={0} aria-valuemax={duration - 1} aria-valuenow={start}
                    aria-valuetext={formatSeconds(start, fps)} data-testid="timeline-start"
                    onPointerDown={(e) => begin(e, layer, 'start')} onKeyDown={(e) => key(e, layer, 'start')} style={{ ...handle, left: 0 }} />
                  <Tip id="timelineBar" side="top">
                    <button type="button" aria-label={`Retime ${name} on the timeline`} data-testid="timeline-move"
                      onPointerDown={(e) => begin(e, layer, 'move')} onKeyDown={(e) => key(e, layer, 'move')}
                      style={{ position: 'absolute', left: 8, right: 8, top: 0, bottom: 0, background: 'transparent', border: 'none', cursor: 'grab', touchAction: 'none' }} />
                  </Tip>
                  <button type="button" role="slider" aria-label={`${name} ends at ${formatSeconds(end, fps)}`} aria-valuemin={0} aria-valuemax={duration - 1} aria-valuenow={end}
                    aria-valuetext={layer.endFrame === undefined ? 'until the end' : formatSeconds(end, fps)} data-testid="timeline-end"
                    onPointerDown={(e) => begin(e, layer, 'end')} onKeyDown={(e) => key(e, layer, 'end')} style={{ ...handle, right: 0 }} />
                </div>
                {playheadFrame !== undefined && <div aria-hidden data-testid="timeline-playhead" style={{ position: 'absolute', top: 0, bottom: 0, left: `${frameToFraction(playheadFrame, duration) * 100}%`, width: 2, marginLeft: -1, background: '#ff4fd8', pointerEvents: 'none', zIndex: 3 }} />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
