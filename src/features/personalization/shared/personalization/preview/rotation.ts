/**
 * Layer rotation helpers: pure math shared by the model (normalizing saved values), the safe-area clamp, the render and the
 * editor. Angles are degrees, positive = clockwise (the CSS `rotate()` direction).
 */

/** An angle as a finite number in (-180, 180], rounded to 0.1 degree. Anything else is 0 (no rotation). */
export function normalizeAngle(deg: unknown): number {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return 0
  let a = deg % 360
  if (a > 180) a -= 360
  else if (a <= -180) a += 360
  a = Math.round(a * 10) / 10
  return Object.is(a, -0) ? 0 : a
}

/** True when the angle is a visible rotation (so callers can leave the property off entirely otherwise). */
export const isRotated = (deg: unknown): boolean => normalizeAngle(deg) !== 0

/** Width and height of the axis-aligned box that exactly contains a `w` x `h` rectangle rotated by `deg` about its center. */
export function rotatedExtent(w: number, h: number, deg: number): { w: number; h: number } {
  const r = (normalizeAngle(deg) * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  return { w: w * c + h * s, h: w * s + h * c }
}

/** CSS `rotate()` for a layer, or '' when it is not rotated. Used by the composition and the editor so they agree. */
export function rotateCss(deg: unknown): string {
  const a = normalizeAngle(deg)
  return a === 0 ? '' : `rotate(${a}deg)`
}
