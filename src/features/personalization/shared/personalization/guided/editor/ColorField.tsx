'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Pipette, Wand2 } from 'lucide-react'
import { C, hintStyle, inputStyle, labelStyle, secondaryButtonStyle } from '../tokens'
import { Tip } from './Tip'
import type { EditorTipId } from './editorTips'
import {
  autoTextColor, averageColor, contrastBetween, extractPalette, gradeContrast, hexToHsv, hsvToHex, parseHex, pushRecent,
  type Hsv,
} from './colorMath'

/**
 * Color control for the editor: replaces the browser's native color input with one popover that
 * has a saturation/brightness area + hue slider, a hex field, an eyedropper (where the browser has
 * one), swatches from the brand, from the customer's own video frame and from recent use, and a live
 * contrast readout against that frame with an "Auto" button.
 */

export interface ColorFieldProps {
  id: string
  /** Visible label text (also names the popover). */
  label: string
  /** Accessible name of the trigger button (kept stable for tests and assistive tech). */
  ariaLabel: string
  value: string
  onChange: (hex: string) => void
  brand: { primary: string; accent: string; text: string }
  /** The video's poster/frame image: colors and the contrast backdrop are read from it, best effort. */
  posterUrl?: string | null
  /** Tooltip for the trigger button. */
  tipId?: EditorTipId
}

const RECENT_KEY = 'personalization:recent-colors'

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list) ? list.filter((c): c is string => typeof c === 'string' && !!parseHex(c)) : []
  } catch { return [] }
}
function writeRecent(list: string[]): void {
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(list)) } catch { /* storage unavailable: recents are a convenience */ }
}

interface FramePalette { colors: string[]; average: string | null }
const PALETTE_CACHE = new Map<string, FramePalette>()

/** Best effort: reads a small copy of the image. A cross-origin image without CORS cannot be read; then there are no colors. */
function sampleFramePalette(url: string): Promise<FramePalette> {
  const cached = PALETTE_CACHE.get(url)
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve) => {
    const done = (p: FramePalette) => { PALETTE_CACHE.set(url, p); resolve(p) }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const w = 64, h = 36
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return done({ colors: [], average: null })
        ctx.drawImage(img, 0, 0, w, h)
        const { data } = ctx.getImageData(0, 0, w, h)
        done({ colors: extractPalette(data, 5), average: averageColor(data) })
      } catch { done({ colors: [], average: null }) }
    }
    img.onerror = () => done({ colors: [], average: null })
    img.src = url
  })
}

const swatchStyle = (color: string, active: boolean): React.CSSProperties => ({
  width: 24, height: 24, borderRadius: '50%', background: color, cursor: 'pointer', padding: 0,
  border: `2px solid ${C.modal}`, outline: `${active ? 2 : 1}px solid ${active ? C.cyan : C.border}`,
})

export function ColorField({ id, label, ariaLabel, value, onChange, brand, posterUrl, tipId }: ColorFieldProps): React.JSX.Element {
  const uid = useId()
  const current = parseHex(value) ?? '#ffffff'
  const [open, setOpen] = useState(false)
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(current))
  const [hexText, setHexText] = useState(current)
  const [recent, setRecent] = useState<string[]>([])
  const [frame, setFrame] = useState<FramePalette>({ colors: [], average: null })
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const startValue = useRef(current)

  // Follow outside changes (undo, reset, preset) without fighting an in-progress drag: keep the hue
  // when the color is gray/black (hex round-trips lose it).
  useEffect(() => {
    setHexText(current)
    setHsv((prev) => {
      if (hsvToHex(prev) === current) return prev
      const next = hexToHsv(current)
      return next.s === 0 || next.v === 0 ? { ...next, h: prev.h } : next
    })
  }, [current])

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false)
    if (current !== startValue.current) {
      setRecent((prev) => { const next = pushRecent(prev, current); writeRecent(next); return next })
    }
    if (restoreFocus) triggerRef.current?.focus()
  }, [current])

  useEffect(() => {
    if (!open) return
    startValue.current = current
    setRecent(readRecent())
    let live = true
    if (posterUrl) void sampleFramePalette(posterUrl).then((p) => { if (live) setFrame(p) })
    else setFrame({ colors: [], average: null })
    // The popover opens below the control, which can be at the bottom of a scrolling modal: bring it
    // fully into view (and focus the picker without letting focus() scroll it back out).
    areaRef.current?.focus({ preventScroll: true })
    const raf = requestAnimationFrame(() => popRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }))
    return () => { live = false; cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on open/close only, not on every color change
  }, [open, posterUrl])

  // The video swatches and recents arrive after the popover opens and make it taller: keep it in view.
  useEffect(() => {
    if (open) popRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [open, frame.colors.length, recent.length])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(true) } }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey, true) }
  }, [open, close])

  const commit = useCallback((next: Hsv) => { setHsv(next); onChange(hsvToHex(next)) }, [onChange])
  const setHex = useCallback((hex: string) => { const p = parseHex(hex); if (p) { setHsv(hexToHsv(p)); onChange(p) } }, [onChange])

  const pickFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = areaRef.current?.getBoundingClientRect()
    if (!r || r.width === 0 || r.height === 0) return
    const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))
    commit({ ...hsv, s, v })
  }
  const onAreaKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.01
    const d = e.key === 'ArrowLeft' ? { s: -step, v: 0 } : e.key === 'ArrowRight' ? { s: step, v: 0 }
      : e.key === 'ArrowUp' ? { s: 0, v: step } : e.key === 'ArrowDown' ? { s: 0, v: -step } : null
    if (!d) return
    e.preventDefault()
    commit({ ...hsv, s: Math.min(1, Math.max(0, hsv.s + d.s)), v: Math.min(1, Math.max(0, hsv.v + d.v)) })
  }

  const eyeDropper = typeof window !== 'undefined' ? (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper : undefined
  const pickWithEyeDropper = async () => {
    try { const r = await new eyeDropper!().open(); setHex(r.sRGBHex) } catch { /* cancelled */ }
  }

  const backdrop = frame.average
  const ratio = backdrop ? contrastBetween(current, backdrop) : null
  const grade = ratio == null ? null : gradeContrast(ratio)
  const Swatches = ({ title, colors }: { title: string; colors: string[] }) => colors.length === 0 ? null : (
    <div>
      <div style={{ ...labelStyle, marginBottom: 4 }}>{title}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {colors.map((c) => (
          <button key={c} type="button" aria-label={`Use ${c}`} title={c} onClick={() => setHex(c)} style={swatchStyle(c, c === current)} />
        ))}
      </div>
    </div>
  )

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <label style={labelStyle} htmlFor={id}>{label}</label>
      {tipId ? <Tip id={tipId}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="color-field-trigger"
        onClick={() => (open ? close(true) : setOpen(true))}
        style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 34, cursor: 'pointer', padding: '0 8px' }}
      >
        <span aria-hidden style={{ width: 20, height: 20, borderRadius: 5, background: current, border: `1px solid ${C.borderStrong}`, flexShrink: 0 }} />
        <span style={{ color: C.text, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{current.toUpperCase()}</span>
      </button>
      </Tip> : (
      <button
        id={id}
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="color-field-trigger"
        onClick={() => (open ? close(true) : setOpen(true))}
        style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 34, cursor: 'pointer', padding: '0 8px' }}
      >
        <span aria-hidden style={{ width: 20, height: 20, borderRadius: 5, background: current, border: `1px solid ${C.borderStrong}`, flexShrink: 0 }} />
        <span style={{ color: C.text, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{current.toUpperCase()}</span>
      </button>
      )}

      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label={`${label} picker`}
          data-testid="color-field-popover"
          style={{
            position: 'absolute', zIndex: 30, top: '100%', left: 0, marginTop: 6, width: 248, padding: 12,
            background: C.modal, border: `1px solid ${C.borderStrong}`, borderRadius: 12, boxShadow: '0 14px 40px rgba(0,0,0,.55)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}
        >
          <div
            ref={areaRef}
            role="slider"
            tabIndex={0}
            aria-label="Saturation and brightness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.s * 100)}
            aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
            data-testid="color-field-area"
            onPointerDown={(e) => { (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId); pickFromPointer(e) }}
            onPointerMove={(e) => { if (e.buttons === 1) pickFromPointer(e) }}
            onKeyDown={onAreaKey}
            style={{
              position: 'relative', height: 120, borderRadius: 8, cursor: 'crosshair', touchAction: 'none',
              background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(${Math.round(hsv.h)}, 100%, 50%))`,
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute', left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, width: 14, height: 14, marginLeft: -7, marginTop: -7,
                borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,.6)', pointerEvents: 'none',
              }}
            />
          </div>

          <input
            type="range"
            min={0}
            max={360}
            step={1}
            value={Math.round(hsv.h)}
            aria-label="Hue"
            data-testid="color-field-hue"
            onChange={(e) => commit({ ...hsv, h: Number(e.target.value) })}
            style={{ width: '100%', height: 10, borderRadius: 6, appearance: 'none', background: 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
          />

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              aria-label="Hex color"
              data-testid="color-field-hex"
              value={hexText}
              onChange={(e) => { setHexText(e.target.value); const p = parseHex(e.target.value); if (p) setHex(p) }}
              onBlur={() => setHexText(current)}
              spellCheck={false}
              maxLength={7}
              style={{ ...inputStyle, flex: 1, height: 32, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
            />
            {eyeDropper && (
              <button type="button" aria-label="Pick a color from the screen" title="Pick a color from the screen" onClick={pickWithEyeDropper}
                style={{ ...secondaryButtonStyle, minHeight: 32, padding: '0 8px' }}><Pipette size={14} /></button>
            )}
            {backdrop && (
              <button type="button" data-testid="color-field-auto" title="Use white or dark, whichever reads best on your video"
                onClick={() => setHex(autoTextColor(backdrop))}
                style={{ ...secondaryButtonStyle, minHeight: 32, padding: '0 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Wand2 size={12} /> Auto
              </button>
            )}
          </div>

          {ratio != null && grade && (
            <div data-testid="color-field-contrast" data-grade={grade} style={{ ...hintStyle, margin: 0, color: grade === 'low' ? C.danger : grade === 'large-text' ? '#fcd34d' : C.green }}>
              {ratio.toFixed(1)}:1 on your video — {grade === 'AAA' ? 'excellent' : grade === 'AA' ? 'good' : grade === 'large-text' ? 'only for large text' : 'hard to read'}
            </div>
          )}

          <Swatches title="Brand" colors={[brand.primary, brand.accent, brand.text].map((c) => parseHex(c)).filter((c): c is string => !!c)} />
          <Swatches title="From your video" colors={frame.colors} />
          <Swatches title="Recent" colors={recent} />
          <span id={`${uid}-help`} style={{ ...hintStyle, margin: 0 }}>Arrow keys move the picker (Shift for bigger steps). Esc closes.</span>
        </div>
      )}
    </div>
  )
}
