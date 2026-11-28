/** Subject-following crops. Pure geometry: a smoothed focal path becomes a crop window for each target shape. */

export type Focal = { t: number; x: number; y: number }
export interface CropRect { x: number; y: number; w: number; h: number }

export const ASPECTS = { '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5, '16:9': 16 / 9 } as const
export type CropAspect = keyof typeof ASPECTS

/** Largest window of the target shape inside the source (normalised 0..1), centred on the focal point and kept inside the frame. */
export function cropWindow(srcW: number, srcH: number, aspect: number, focal: { x: number; y: number }, zoom = 1): CropRect {
  const srcAspect = srcW / srcH
  let w = 1, h = 1
  if (aspect > srcAspect) h = srcAspect / aspect
  else w = aspect / srcAspect
  w /= Math.max(1, zoom); h /= Math.max(1, zoom)
  return { w, h, x: Math.min(1 - w, Math.max(0, focal.x - w / 2)), y: Math.min(1 - h, Math.max(0, focal.y - h / 2)) }
}

/** Exponential smoothing with a per-second speed limit so the crop never jumps. */
export function smoothFocalPath(path: Focal[], opts: { alpha?: number; maxSpeed?: number } = {}): Focal[] {
  const { alpha = 0.35, maxSpeed = 0.25 } = opts
  if (!path.length) return []
  const out: Focal[] = [{ ...path[0]! }]
  for (let i = 1; i < path.length; i++) {
    const p = path[i]!, prev = out[i - 1]!
    const dt = Math.max(0.001, p.t - prev.t)
    const lim = (target: number, cur: number) => {
      const wanted = cur + (target - cur) * alpha
      const maxStep = maxSpeed * dt
      return cur + Math.max(-maxStep, Math.min(maxStep, wanted - cur))
    }
    out.push({ t: p.t, x: lim(p.x, prev.x), y: lim(p.y, prev.y) })
  }
  return out
}

export interface CropPlan { aspect: CropAspect; keyframes: { t: number; rect: CropRect }[]; subjectInside: boolean }

/** One plan per target shape. `subject` (normalised box) is checked against the final window so the UI can say when it was cut off. */
export function planCrops(srcW: number, srcH: number, focals: Focal[], aspects: CropAspect[], subject?: CropRect, zoom = 1): CropPlan[] {
  const path = smoothFocalPath(focals.length ? focals : [{ t: 0, x: 0.5, y: 0.5 }])
  return aspects.map((a) => {
    const keyframes = path.map((f) => ({ t: f.t, rect: cropWindow(srcW, srcH, ASPECTS[a], f, zoom) }))
    const subjectInside = !subject || keyframes.every(({ rect }) => subject.x >= rect.x - 0.01 && subject.x + subject.w <= rect.x + rect.w + 0.01 && subject.y >= rect.y - 0.01 && subject.y + subject.h <= rect.y + rect.h + 0.01)
    return { aspect: a, keyframes, subjectInside }
  })
}

export function zoneCenter(z: { x: number; y: number; w: number; h: number }): { x: number; y: number } { return { x: z.x + z.w / 2, y: z.y + z.h / 2 } }
