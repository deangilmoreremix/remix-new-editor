/**
 * Animated text. ONE function, `textFrame`, says how the text looks at any moment. The preview (Web Animations keyframes sampled from it)
 * and the export (frames painted onto the video) both call it, so what you preview is what is rendered.
 */
export type TextPreset = 'fade' | 'slide' | 'scale' | 'pop' | 'typewriter' | 'bounce' | 'reveal'
export const TEXT_PRESETS: Array<{ id: TextPreset; label: string }> = [
  { id: 'fade', label: 'Fade' }, { id: 'slide', label: 'Slide up' }, { id: 'scale', label: 'Scale' }, { id: 'pop', label: 'Pop' },
  { id: 'typewriter', label: 'Typewriter' }, { id: 'bounce', label: 'Bounce' }, { id: 'reveal', label: 'Reveal' },
]

export interface TextFrame {
  opacity: number
  /** Offsets as a fraction of the frame width / height. */
  dx: number
  dy: number
  scale: number
  /** Fraction of the characters shown (typewriter), 0..1. */
  chars: number
  /** Fraction of the text width revealed left to right, 0..1. */
  reveal: number
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
export const easeOutCubic = (p: number) => 1 - (1 - clamp01(p)) ** 3
export const easeOutBack = (p: number) => { const c1 = 1.70158, c3 = c1 + 1, x = clamp01(p) - 1; return 1 + c3 * x ** 3 + c1 * x ** 2 }
export const easeOutBounce = (p: number) => {
  let x = clamp01(p); const n = 7.5625, d = 2.75
  if (x < 1 / d) return n * x * x
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375
  return n * (x -= 2.625 / d) * x + 0.984375
}

export interface TextTiming { inSec?: number; outSec?: number; /** Number of characters, for the typewriter pace. */ length?: number }

/** `t` = seconds since the text appears, `dur` = how long it stays. Outside 0..dur nothing is visible. */
export function textFrame(preset: TextPreset, t: number, dur: number, { inSec = 0.5, outSec = 0.3, length = 20 }: TextTiming = {}): TextFrame {
  const hidden: TextFrame = { opacity: 0, dx: 0, dy: 0, scale: 1, chars: 0, reveal: 0 }
  if (!(dur > 0) || t < 0 || t > dur) return hidden
  const inLen = Math.min(inSec, dur / 2), outLen = Math.min(outSec, dur / 2)
  const p = inLen > 0 ? clamp01(t / inLen) : 1
  const out = outLen > 0 ? clamp01((dur - t) / outLen) : 1
  const f: TextFrame = { opacity: 1, dx: 0, dy: 0, scale: 1, chars: 1, reveal: 1 }
  switch (preset) {
    case 'fade': f.opacity = p; break
    case 'slide': f.opacity = p; f.dy = (1 - easeOutCubic(p)) * 0.08; break
    case 'scale': f.opacity = p; f.scale = 0.6 + 0.4 * easeOutCubic(p); break
    case 'pop': f.opacity = clamp01(p * 3); f.scale = easeOutBack(p); break
    case 'typewriter': { const typeSec = Math.max(inLen, Math.min(dur * 0.6, length * 0.05)); f.chars = clamp01(t / typeSec); break }
    case 'bounce': f.opacity = clamp01(p * 2); f.dy = -(1 - easeOutBounce(p)) * 0.12; break
    case 'reveal': f.reveal = easeOutCubic(p); break
  }
  f.opacity *= out
  return f
}

/** Web Animations API keyframes sampled from `textFrame`. (Typewriter is previewed with `chars` directly; see the component.) */
export function toKeyframes(preset: TextPreset, dur: number, timing: TextTiming = {}, samples = 16): Keyframe[] {
  const frames: Keyframe[] = []
  for (let i = 0; i <= samples; i++) {
    const t = (dur * i) / samples
    const f = textFrame(preset, t, dur, timing)
    frames.push({
      offset: i / samples,
      opacity: f.opacity,
      transform: `translate(${(f.dx * 100).toFixed(2)}%, ${(f.dy * 100).toFixed(2)}%) scale(${f.scale.toFixed(4)})`,
      clipPath: `inset(0 ${((1 - f.reveal) * 100).toFixed(2)}% 0 0)`,
    })
  }
  return frames
}

export interface TextOverlay {
  text: string
  start: number
  end: number
  preset: TextPreset
  position: 'top' | 'middle' | 'bottom'
  /** Font size as a fraction of the frame height. */
  size: number
  color: string
  bold?: boolean
}

export const defaultOverlay = (over: Partial<TextOverlay> = {}): TextOverlay => ({ text: 'Your text', start: 0, end: 3, preset: 'pop', position: 'middle', size: 0.08, color: '#ffffff', bold: true, ...over })

/** Pure line wrapping (greedy). `measure` returns the pixel width of a string. */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = []
  for (const para of String(text).split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (line && measure(next) > maxWidth) { lines.push(line); line = word } else line = next
    }
    lines.push(line)
  }
  return lines.length ? lines : ['']
}

/** Paints one overlay onto a 2D context for video time `t`. A no-op outside its time range. */
export function drawTextOverlay(ctx: any, o: TextOverlay, t: number, W: number, H: number): boolean {
  const dur = o.end - o.start
  const f = textFrame(o.preset, t - o.start, dur, { length: o.text.length })
  if (f.opacity <= 0 || !o.text.trim()) return false
  const px = Math.max(10, Math.round(o.size * H))
  ctx.save()
  ctx.font = `${o.bold === false ? 400 : 700} ${px}px system-ui, -apple-system, "Segoe UI", sans-serif`
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  const lines = wrapLines(o.text, W * 0.88, (s) => ctx.measureText(s).width)
  const lineH = px * 1.2, blockH = lines.length * lineH
  const cy = o.position === 'top' ? H * 0.14 + blockH / 2 : o.position === 'bottom' ? H * 0.86 - blockH / 2 : H / 2
  const cx = W / 2
  ctx.globalAlpha = Math.min(1, Math.max(0, f.opacity))
  ctx.translate(cx + f.dx * W, cy + f.dy * H)
  ctx.scale(f.scale, f.scale)
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
  if (f.reveal < 1) { ctx.beginPath(); ctx.rect(-widest / 2, -blockH / 2, widest * f.reveal, blockH); ctx.clip() }
  let shown = Math.ceil(o.text.length * f.chars)
  lines.forEach((line, i) => {
    const take = Math.max(0, Math.min(line.length, shown)); shown -= line.length + 1
    if (take <= 0) return
    const y = -blockH / 2 + lineH * (i + 0.5)
    const x = -ctx.measureText(line).width / 2 // anchored on the FULL line so typed-in text does not drift
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, px * 0.12); ctx.strokeStyle = 'rgba(0,0,0,0.75)'
    ctx.strokeText(line.slice(0, take), x, y)
    ctx.fillStyle = o.color
    ctx.fillText(line.slice(0, take), x, y)
  })
  ctx.restore()
  return true
}
