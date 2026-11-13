import React from 'react'
import { collageTiles } from './imagePresets'
import {
  borderPx,
  borderRadiusCss,
  frameRect,
  imageMediaStyle,
  resolveBorderColor,
  hexToRgba,
  shadowCss,
  type ImageStyle,
} from './imageStyle'

export interface StyledImageProps {
  src: string
  alt?: string
  style?: React.CSSProperties
}

export interface StyledBusinessImageProps {
  src: string
  /** The resolved style (see `resolveImageStyle`). */
  imageStyle: ImageStyle
  /** The layer box in THIS surface's pixels. */
  boxWidth: number
  boxHeight: number
  /** Composition height in composition pixels (radius/border/shadow scale from it). */
  compHeight: number
  /** Composition SHORTER side in composition px (corner radius scales from it; defaults to compHeight). */
  compShort?: number
  /** Surface pixels per composition pixel: 1 in the composition, the stage factor in the editor. */
  factor?: number
  brand: { primary: string; accent: string }
  /** Natural width / height when known, so the frame can hug a contained picture. */
  aspect?: number
  /** Image renderer: Remotion's `Img` inside the composition, a plain `<img>` elsewhere. */
  ImageComponent?: React.ComponentType<StyledImageProps>
  testId?: string
  /** Cinematic reveal progress 0..1 (1 = fully shown) and the settle scale; frame-driven by the caller. */
  revealProgress?: number
  revealScale?: number
}

const PlainImg: React.FC<StyledImageProps> = ({ src, alt = '', style }) => (
  <img src={src} alt={alt} style={style} draggable={false} />
)

/** Heart doodle + sparkles (inline SVG, strokes only so it survives any renderer). */
const HeartDoodle: React.FC<{ size: number }> = ({ size }) => (
  <svg data-styled-image="heart" width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
    <path d="M12 20.5C6 16 3 12.6 3 9a4.5 4.5 0 0 1 9-1.2A4.5 4.5 0 0 1 21 9c0 3.6-3 7-9 11.5Z" fill="none" stroke="#ff5a7a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const Sparkle: React.FC<{ size: number }> = ({ size }) => (
  <svg data-styled-image="sparkle" width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
    <path d="M12 1v22M1 12h22M5 5l14 14M19 5L5 19" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,0.6))" }} />
  </svg>
)

/**
 * A business image drawn as a polished overlay.
 *
 * Structure (why two wrappers): `overflow: hidden` + `border-radius` clip the
 * picture, which would also clip a shadow drawn on the same element. So the
 * OUTER element carries the shadow (same radius, no clipping) and the INNER one
 * carries the clip, border and fill. The original file is never altered — the
 * rounding is pure presentation.
 *
 * An unstyled/`square` style with no border, shadow or fill renders exactly like
 * a plain contained image, so logos and already-framed pictures are untouched.
 */
export const StyledBusinessImage: React.FC<StyledBusinessImageProps> = ({
  src, imageStyle, boxWidth, boxHeight, compHeight, compShort, factor = 1, brand, aspect, ImageComponent = PlainImg, testId, revealProgress = 1, revealScale = 1,
}) => {
  const frame = frameRect(imageStyle, boxWidth, boxHeight, aspect)
  const comp = { short: compShort ?? compHeight, factor }
  const radius = borderRadiusCss(imageStyle, frame, comp)
  const border = borderPx(imageStyle, compHeight, factor)
  const shadow = shadowCss(imageStyle, compHeight, factor)
  const plain = imageStyle.shape === 'square' && !border && !shadow && !imageStyle.fill

  const image = (
    <ImageComponent
      src={src}
      style={{
        width: '100%',
        height: '100%',
        objectFit: imageStyle.fit,
        ...imageMediaStyle(imageStyle),
        display: 'block',
      }}
    />
  )

  const reveal = imageStyle.reveal
  const hasPreset = imageStyle.spotlight || imageStyle.frame === 'polaroid' || imageStyle.mask === 'soft' || !!reveal || !!imageStyle.tilt || !!imageStyle.badge

  if (hasPreset) {
    const short = Math.min(frame.width, frame.height)
    const polaroid = imageStyle.frame === 'polaroid'
    const pad = polaroid ? Math.round(short * 0.05) : 0
    const padBottom = polaroid ? Math.round(short * 0.17) : 0
    const outer = { left: frame.left - pad, top: frame.top - pad, width: frame.width + 2 * pad, height: frame.height + pad + padBottom }
    const outerRadius = polaroid ? `${Math.round(short * 0.02)}px` : radius
    const soft = imageStyle.mask === 'soft'
    const mask = soft ? 'radial-gradient(ellipse at center, #000 38%, rgba(0,0,0,0) 98%)' : undefined
    const wipe = reveal === 'wipe'
    const diagonal = reveal === 'diagonal'
    // Diagonal wipe: the edge slants by SKEW % and travels from 0 to 100 + SKEW; clip-path polygon, frame-driven.
    const SKEW = 22
    const edgeTop = revealProgress * (100 + SKEW)
    const edgeBottom = edgeTop - SKEW
    const clamp100 = (v: number) => Math.max(0, Math.min(100, v))
    const clip = wipe
      ? `inset(0 ${Math.round((1 - revealProgress) * 100)}% 0 0)`
      : diagonal && revealProgress < 1
        ? `polygon(0% 0%, ${clamp100(edgeTop).toFixed(2)}% 0%, ${clamp100(edgeBottom).toFixed(2)}% 100%, 0% 100%)`
        : undefined
    const streak = diagonal && revealProgress > 0.001 && revealProgress < 0.999
      ? `polygon(${clamp100(edgeTop - 5).toFixed(2)}% 0%, ${clamp100(edgeTop).toFixed(2)}% 0%, ${clamp100(edgeBottom).toFixed(2)}% 100%, ${clamp100(edgeBottom - 5).toFixed(2)}% 100%)`
      : null
    const transforms = [
      imageStyle.tilt ? `rotate(${imageStyle.tilt}deg)` : '',
      revealScale !== 1 ? `scale(${revealScale})` : '',
    ].filter(Boolean).join(' ')
    // A soft mask feathers the edge, so the glow follows the visible silhouette (drop-shadow is alpha-aware).
    const glowFilter = soft && imageStyle.glow ? `drop-shadow(0 0 ${Math.round(short * 0.06)}px ${hexToRgba(imageStyle.glow, 0.7)})` : undefined
    const outerShadow = soft ? undefined : shadow
    const badgeSize = Math.max(10, Math.round(short * 0.075))
    return (
      <div data-styled-image="preset" data-preset={imageStyle.presetId} data-testid={testId} style={{ position: 'absolute', inset: 0 }}>
        {imageStyle.spotlight && (
          <div
            data-styled-image="spotlight"
            style={{
              position: 'absolute',
              left: frame.left - frame.width * 0.35,
              top: frame.top - frame.height * 0.35,
              width: frame.width * 1.7,
              height: frame.height * 1.7,
              background: `radial-gradient(closest-side, ${hexToRgba(imageStyle.glow ?? '#ffffff', 0.3)}, rgba(255,255,255,0))`,
              pointerEvents: 'none',
            }}
          />
        )}
        <div
          data-styled-image="outer"
          data-shape={imageStyle.shape}
          style={{
            position: 'absolute',
            ...outer,
            borderRadius: outerRadius,
            boxShadow: outerShadow, // on the OUTER wrapper: never clipped
            filter: glowFilter,
            transform: transforms || undefined,
            transformOrigin: 'center center',
            opacity: wipe ? revealProgress : undefined,
          }}
        >
          <div
            data-styled-image="clip"
            style={{
              width: '100%',
              height: '100%',
              borderRadius: outerRadius,
              overflow: 'hidden',
              boxSizing: 'border-box',
              background: polaroid ? '#ffffff' : imageStyle.fill ?? undefined,
              padding: polaroid ? `${pad}px ${pad}px ${padBottom}px` : undefined,
              border: !polaroid && border ? `${border}px solid ${resolveBorderColor(imageStyle.borderColor, brand)}` : undefined,
              WebkitMaskImage: mask,
              maskImage: mask,
              clipPath: clip,
            }}
          >
            <div style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: polaroid ? `${Math.round(short * 0.01)}px` : undefined }}>{image}</div>
          </div>
          {streak && (
            <div
              data-styled-image="streak"
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: outerRadius,
                clipPath: streak,
                background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 100%)',
                filter: `drop-shadow(0 0 ${Math.max(4, Math.round(short * 0.03))}px rgba(255,255,255,0.9))`,
              }}
            />
          )}
          {polaroid && imageStyle.accent === 'heart' && (
            <>
              <div style={{ position: 'absolute', right: pad * 1.2, bottom: padBottom * 0.18 }}><HeartDoodle size={Math.round(padBottom * 0.62)} /></div>
              <div style={{ position: 'absolute', right: -Math.round(short * 0.03), top: -Math.round(short * 0.03) }}><Sparkle size={Math.round(short * 0.16)} /></div>
              <div style={{ position: 'absolute', left: -Math.round(short * 0.02), top: Math.round(short * 0.12) }}><Sparkle size={Math.round(short * 0.1)} /></div>
            </>
          )}
          {imageStyle.badge && (
            <div
              data-styled-image="badge"
              style={{
                position: 'absolute', left: -Math.round(badgeSize * 0.4), top: -Math.round(badgeSize * 0.5),
                padding: `${Math.round(badgeSize * 0.3)}px ${Math.round(badgeSize * 0.7)}px`, borderRadius: 999,
                background: brand.accent, color: '#ffffff', fontWeight: 800, fontSize: badgeSize, lineHeight: 1.1,
                whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
              }}
            >
              {imageStyle.badge}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (plain) {
    return (
      <div data-styled-image="plain" data-testid={testId} style={{ position: 'absolute', left: frame.left, top: frame.top, width: frame.width, height: frame.height }}>
        {image}
      </div>
    )
  }

  return (
    <div
      data-styled-image="outer"
      data-shape={imageStyle.shape}
      data-testid={testId}
      style={{
        position: 'absolute',
        left: frame.left,
        top: frame.top,
        width: frame.width,
        height: frame.height,
        borderRadius: radius,
        boxShadow: shadow, // on the OUTER wrapper: never clipped
      }}
    >
      <div
        data-styled-image="clip"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: radius,
          overflow: 'hidden',
          boxSizing: 'border-box',
          background: imageStyle.fill ?? undefined,
          border: border ? `${border}px solid ${resolveBorderColor(imageStyle.borderColor, brand)}` : undefined,
        }}
      >
        {image}
      </div>
    </div>
  )
}


/**
 * 2–4 pictures in rounded tiles with even spacing (Multi-Image Collage). Two pictures stack
 * vertically, each tile with a thin white border. Tiles never overlap; each crops to fill.
 */
export const ImageCollage: React.FC<{
  urls: string[]
  imageStyle: ImageStyle
  boxWidth: number
  boxHeight: number
  compHeight: number
  compShort?: number
  factor?: number
  brand: { primary: string; accent: string }
  ImageComponent?: React.ComponentType<StyledImageProps>
  testId?: string
}> = ({ urls, imageStyle, boxWidth, boxHeight, compHeight, compShort, factor = 1, brand, ImageComponent = PlainImg, testId }) => {
  const tiles = collageTiles(urls.length)
  const border = borderPx(imageStyle, compHeight, factor)
  const shadow = shadowCss(imageStyle, compHeight, factor)
  const comp = { short: compShort ?? compHeight, factor }
  return (
    <div data-styled-image="collage" data-count={tiles.length} data-testid={testId} style={{ position: 'absolute', inset: 0 }}>
      {tiles.map((t, i) => {
        const w = t.w * boxWidth
        const h = t.h * boxHeight
        const radius = borderRadiusCss(imageStyle, { width: w, height: h }, comp)
        return (
          <div key={i} data-styled-image="tile" style={{ position: 'absolute', left: t.x * boxWidth, top: t.y * boxHeight, width: w, height: h, borderRadius: radius, boxShadow: shadow }}>
            <div style={{ width: '100%', height: '100%', borderRadius: radius, overflow: 'hidden', boxSizing: 'border-box', border: border ? `${border}px solid ${resolveBorderColor(imageStyle.borderColor, brand)}` : undefined }}>
              <ImageComponent src={urls[i]} style={{ width: '100%', height: '100%', objectFit: 'cover', ...imageMediaStyle(imageStyle, true), display: 'block' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Polygon (px) of a split panel with a diagonal divider, in composition coordinates. */
export function splitPanelPolygon(side: 'left' | 'right' | 'top' | 'bottom', w: number, h: number): { points: [number, number][]; line: [[number, number], [number, number]] } {
  const horizontal = side === 'left' || side === 'right'
  const s = (horizontal ? w : h) * 0.06 // the divider leans by 2s over the frame
  const cx = w / 2
  const cy = h / 2
  let points: [number, number][]
  let line: [[number, number], [number, number]]
  if (side === 'right') { points = [[cx + s, 0], [w, 0], [w, h], [cx - s, h]]; line = [[cx + s, 0], [cx - s, h]] }
  else if (side === 'left') { points = [[0, 0], [cx + s, 0], [cx - s, h], [0, h]]; line = [[cx + s, 0], [cx - s, h]] }
  else if (side === 'bottom') { points = [[0, cy + s], [w, cy - s], [w, h], [0, h]]; line = [[0, cy + s], [w, cy - s]] }
  else { points = [[0, 0], [w, 0], [w, cy - s], [0, cy + s]]; line = [[0, cy + s], [w, cy - s]] }
  return { points, line }
}

/**
 * A half-frame picture panel (Split Screen) behind a DIAGONAL divider with a thin white line: the
 * picture fills one side, the customer's video the other. A soft shadow falls on the video side.
 * Drawn with a clip-path polygon (verified in the real exporter).
 */
export const SplitPanel: React.FC<{
  src: string
  side: 'left' | 'right' | 'top' | 'bottom'
  imageStyle: ImageStyle
  compWidth: number
  compHeight: number
  ImageComponent?: React.ComponentType<StyledImageProps>
  testId?: string
}> = ({ src, side, imageStyle, compWidth, compHeight, ImageComponent = PlainImg, testId }) => {
  const { points, line } = splitPanelPolygon(side, compWidth, compHeight)
  const poly = `polygon(${points.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(', ')})`
  const [[x1, y1], [x2, y2]] = line
  const len = Math.hypot(x2 - x1, y2 - y1)
  const angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI
  const thick = Math.max(2, Math.round(compHeight * 0.003))
  return (
    <div data-styled-image="split" data-side={side} data-testid={testId} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div
        data-styled-image="split-panel"
        style={{
          position: 'absolute', inset: 0, clipPath: poly, overflow: 'hidden',
          filter: imageStyle.shadow === 'none' ? undefined : `drop-shadow(0 0 ${Math.round(compHeight * 0.02)}px rgba(0,0,0,0.35))`,
        }}
      >
        <ImageComponent src={src} style={{ width: '100%', height: '100%', objectFit: 'cover', ...imageMediaStyle(imageStyle, true), display: 'block' }} />
      </div>
      <div
        data-styled-image="split-line"
        style={{
          position: 'absolute', left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - thick / 2, width: len, height: thick,
          background: '#ffffff', transform: `rotate(${angle}deg)`, transformOrigin: 'center center', boxShadow: '0 0 6px rgba(255,255,255,0.6)',
        }}
      />
    </div>
  )
}
