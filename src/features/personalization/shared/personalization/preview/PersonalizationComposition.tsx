import { contractFor, layerZIndex, roleForLayer } from './mediaRoles'
import { CutoutBackdrop } from './cutout/CutoutBackdrop'
import { ownText, resolveLayerImageUrl, resolveLayerText } from './layerContent'
import { endCardFrames } from './endCard'
import { exitFactors, revealFactors } from './imageStyle'
import { presetStyle, resolveImageLook } from './imagePresets'
import { ImageCollage, SplitPanel, StyledBusinessImage } from './StyledBusinessImage'
import React, { useCallback, useEffect, useState } from 'react'
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Internals,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { Video, Audio } from '@remotion/media'
import { fontStackById, isImageLayerKind, toBox } from './presets'
import { entranceFor, exitFor, itemEntrance, usesWordEntrance, wordEntrance } from './motion'
import { rotateCss, rotatedExtent } from './rotation'
import { isNeutralKeyframeState, keyframeStateFor, keyframeTransformParts } from './keyframes'
import { layerEffectsFilter, lookFilter } from './effects'
import { LookLayers } from './LookLayers'
import { accentRuleStyle, ctaPillStyle, endCardBackground, isSingleLineBox, layerTextStyle, textAlignFor, type TextStyleKind } from './textStyle'
import { hasTextScrim, scrimForBox, scrimPeakAt, scrimStyle } from './scrim'
import { layerBoxMetrics } from '../guided/overlayGeometry'
import { resolveDesignSlotValues } from './designSlots'
import { toPlayablePreviewMediaUrl } from './remoteMedia'
import {
  clearPreviewMediaFailure,
  emitPreviewMediaFailure,
  previewMediaLabel,
} from './previewMediaEvents'
import { getRemotionDesignTemplate, subscribeRemotionDesignRegistry } from '../templates'
import type {
  RemotionDesignComponentProps,
  RemotionDesignTemplate,
} from '../templates/types'
import type {
  PreviewInputProps,
  PreviewLayer,
  PersonalizationPreviewSettings,
} from './types'

const TEXT_LAYER_KINDS: PreviewLayer['kind'][] = [
  'businessName',
  'headline',
  'offer',
  'cta',
  'tagline',
]

const PILL_TEXT_COLOR = '#000000'

/**
 * The <Player> does not provide remotion's internal SequenceManager context and
 * never consumes its sequence registry. Remotion's media components still
 * attempt to register themselves when NODE_ENV === "test" (outside the Studio),
 * which throws without a provider. A stable local no-op keeps the composition
 * renderable under jsdom/vitest without changing browser behavior.
 */
const NOOP_SEQUENCE_MANAGER = {
  registerSequence: () => {},
  unregisterSequence: () => {},
  sequences: [],
}

/**
 * Remotion 4.0.5xx removed `Internals.SequenceManager` (the registry moved to other contexts), and reading
 * `.Provider` off `undefined` crashed EVERY render of the composition: the preview, the template cards and the
 * export all showed black. The wrapper only exists for the jsdom/test case above, so it is applied only when
 * the installed Remotion still has it; a real browser renders the children directly.
 */
function MaybeSequenceManager({ children }: { children: React.ReactNode }): React.JSX.Element {
  const Provider = (Internals as unknown as {
    SequenceManager?: { Provider?: React.ComponentType<{ value: unknown; children?: React.ReactNode }> }
  }).SequenceManager?.Provider
  return Provider ? <Provider value={NOOP_SEQUENCE_MANAGER}>{children}</Provider> : <>{children}</>
}

/** Dark text on light colors, white on dark ones (hex colors; else the default). */
export function readableTextOn(background: string, dark: string): string {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(background.trim())
  if (!match) return dark
  const hex = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1]
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return luminance > 0.18 ? dark : '#ffffff'
}

/**
 * Design ids we already warned about.
 *
 * The composition renders once per frame, so a missing template would print
 * the same warning hundreds of times per second. Warn once per id instead.
 */
const warnedDesignIds = new Set<string>()

function warnMissingDesignOnce(designId: string | undefined): void {
  const key = designId ?? '(none)'
  if (warnedDesignIds.has(key)) return
  warnedDesignIds.add(key)
  console.warn(
    `[personalization] No Remotion design template is registered for "${key}". The design layer will not render.`,
  )
}

/**
 * Resolves every text slot of a design.
 *
 * The shared resolver in `./designSlots` owns the precedence rule, so the
 * inspector and the render can never disagree:
 *
 *  - the PRIMARY slot takes the layer's own `text` (the legacy contract);
 *  - every other slot takes its stored override when that override is a
 *    non-empty string;
 *  - otherwise the slot falls back to its brand field.
 */
function resolveDesignTextSlots(
  design: RemotionDesignTemplate,
  layer: PreviewLayer,
  brand: PreviewInputProps['brand'],
): Record<string, string> {
  return resolveDesignSlotValues(design, layer, brand)
}

/**
 * Resolves the media a design can use.
 *
 * The layer's own image replaces the design's primary (required) media
 * binding; every other role is fed by the matching brand asset.
 */
function resolveDesignMedia(
  design: RemotionDesignTemplate,
  layer: PreviewLayer,
  brand: PreviewInputProps['brand'],
): Record<string, string | null> {
  const media: Record<string, string | null> = {}
  const declared = Array.isArray(design.media) ? design.media : []
  const primary = declared.find((binding) => binding && binding.required) ?? declared[0]
  for (const binding of declared) {
    if (!binding || typeof binding.role !== 'string') continue
    if (primary && binding.role === primary.role && layer.imageUrl) {
      media[binding.role] = layer.imageUrl
      continue
    }
    if (binding.role === 'logo') media[binding.role] = brand.logoUrl ?? null
    else if (binding.role === 'product') media[binding.role] = brand.productUrl ?? null
    else if (binding.role === 'service') media[binding.role] = brand.serviceUrl ?? null
    else media[binding.role] = null
  }
  return media
}

const EndCard: React.FC<{
  settings: PersonalizationPreviewSettings
  brand: PreviewInputProps['brand']
}> = ({ settings, brand }) => {
  const frame = useCurrentFrame()
  const fade = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })
  const logoUrl = brand.logoUrl
  const contactLine = [brand.phone, brand.website].filter((value) => value && value.trim()).join('   ·   ')
  const ctaText = brand.cta && brand.cta.trim() ? brand.cta : ''
  // Dark text on a light brand color, white on a dark one (was always dark).
  const onPrimary = readableTextOn(settings.brandColors.primary, PILL_TEXT_COLOR)
  const rise = Math.round(settings.height * 0.03)
  const item = (index: number): React.CSSProperties => {
    const e = itemEntrance(index, frame, settings.fps, rise)
    return { opacity: e.opacity, transform: e.translateY ? `translateY(${e.translateY}px)` : undefined }
  }

  return (
    <AbsoluteFill
      style={{
        background: endCardBackground(settings.brandColors.primary),
        // Fully opaque once faded in: overlays beneath must not ghost through the card.
        opacity: fade,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Math.round(settings.height * 0.02),
        pointerEvents: 'none',
      }}
    >
      {logoUrl ? (
        <Img
          src={logoUrl}
          style={{
            width: Math.round(settings.width * 0.18),
            height: Math.round(settings.width * 0.18),
            objectFit: 'contain',
            ...item(0),
          }}
        />
      ) : null}
      {brand.businessName ? (
        <div
          style={{
            fontFamily: fontStackById(),
            color: onPrimary,
            fontSize: Math.round(settings.height * 0.055),
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: '-0.01em',
            textAlign: 'center',
            wordBreak: 'break-word',
            width: '90%',
            ...item(1),
          }}
        >
          {brand.businessName}
        </div>
      ) : null}
      {contactLine ? (
        <div
          style={{
            fontFamily: fontStackById(),
            color: onPrimary,
            fontSize: Math.round(settings.height * 0.032),
            fontWeight: 600,
            lineHeight: 1.2,
            letterSpacing: '0.02em',
            textAlign: 'center',
            ...item(2),
          }}
        >
          {contactLine}
        </div>
      ) : null}
      {brand.contactExtra ? (
        <div
          data-testid="pz-endcard-extra"
          style={{
            fontFamily: fontStackById(),
            color: onPrimary,
            fontSize: Math.round(settings.height * 0.028),
            fontWeight: 600,
            lineHeight: 1.2,
            letterSpacing: '0.02em',
            textAlign: 'center',
            width: '90%',
            wordBreak: 'break-word',
            ...item(2),
          }}
        >
          {brand.contactExtra}
        </div>
      ) : null}
      {ctaText ? (
        <div style={{ width: '100%', textAlign: 'center', ...item(3) }}>
          <span
            style={ctaPillStyle({
              background: settings.brandColors.accent,
              color: readableTextOn(settings.brandColors.accent, PILL_TEXT_COLOR),
              fontSizePx: Math.round(settings.height * 0.036),
            })}
          >
            {ctaText}
          </span>
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

/**
 * Free, browser-based personalization preview composition. Renders the selected
 * source video (or poster image) as the background layer with the customer's
 * branding overlays on top. Never calls any paid API.
 */
export const PersonalizationComposition: React.FC<PreviewInputProps> = ({
  videoUrl,
  posterUrl,
  isImageSource,
  audioUrl,
  settings,
  brand,
  lumaSamples,
}) => {
  const frame = useCurrentFrame()
  const videoConfig = useVideoConfig()
  const compW = settings.width > 0 ? settings.width : videoConfig.width
  const compH = settings.height > 0 ? settings.height : videoConfig.height
  const [mediaFailed, setMediaFailed] = useState(false)

  // The design catalog registers itself on import. Re-render when the registry
  // changes so a design that lands after the first paint is picked up.
  const [, setRegistryVersion] = useState(0)
  useEffect(
    () => subscribeRemotionDesignRegistry(() => setRegistryVersion((version) => version + 1)),
    [],
  )

  // A browser media element that cannot be decoded/loaded (codec, network or
  // CORS restrictions on unusual remote URLs) would otherwise surface as an
  // unhandled error from the media component. Record it and render the same
  // static fallback used when no video is selected. `'fallback'` is the
  // component's own default action (it may retry through its HTML fallback);
  // during a web-renderer export the same failure cancels the render with an
  // actionable error instead of silently producing a broken video.
  const handleMediaError = useCallback((): 'fallback' => {
    setMediaFailed(true)
    // Report the failure on the module-level channel so the player wrapper can
    // show an actionable message instead of a silent placeholder. The local
    // `mediaFailed` state above still drives the poster fallback.
    emitPreviewMediaFailure({
      videoUrl: videoUrl ?? null,
      posterUrl: posterUrl ?? null,
      label: previewMediaLabel(videoUrl ?? null),
      reason: 'MEDIA_ELEMENT_ERROR',
    })
    return 'fallback'
  }, [videoUrl, posterUrl])

  // Switching videos in the wizard must clear a failure recorded for the
  // previously selected source, in the composition and on the shared channel.
  useEffect(() => {
    setMediaFailed(false)
    clearPreviewMediaFailure()
  }, [videoUrl])

  // Keyframes move, scale, tilt and fade a layer on top of its own animation. They are applied by wrapping whatever the
  // layer draws, about the layer's own center, and only while a keyframe is actually changing something, so a layer
  // without keyframes is drawn exactly as before.
  const withKeyframes = (layer: PreviewLayer, node: React.ReactNode): React.ReactNode => {
    if (!node || layer.kind === 'design' || !layer.keyframes?.length) return node
    const state = keyframeStateFor(layer.keyframes, frame)
    if (isNeutralKeyframeState(state)) return node
    const m = layerBoxMetrics(layer, compW, compH, isImageLayerKind(layer.kind) ? undefined : resolveLayerText(layer, brand))
    const cx = m.leftPx + m.widthPx / 2
    const cy = m.topPx + m.heightPx / 2
    return (
      <AbsoluteFill
        key={layer.id}
        style={{
          zIndex: layerZIndex(roleForLayer(layer), visibleLayers.indexOf(layer)),
          transform: keyframeTransformParts(state, compW, compH).join(' ') || undefined,
          transformOrigin: `${cx}px ${cy}px`,
          opacity: state.opacity,
          pointerEvents: 'none',
        }}
      >
        {node}
      </AbsoluteFill>
    )
  }
  // The footage's look: a filter on the picture itself, plus color overlays and a vignette drawn over it (LookLayers).
  const lookCss = lookFilter(settings.look)
  const cutoutActive = Boolean(settings.cutout?.enabled && videoUrl && !isImageSource && !mediaFailed)

  const renderBackground = () => {
    if (cutoutActive && videoUrl && settings.cutout) {
      // The presenter is cut out of every frame and drawn over the chosen background by CutoutBackdrop.
      // It draws pixels only, so the source's own sound is kept with an audio-only element.
      return (
        <>
          <CutoutBackdrop videoUrl={videoUrl} cutout={settings.cutout} width={compW} height={compH} filter={lookCss} />
          <Audio src={toPlayablePreviewMediaUrl(videoUrl)} />
        </>
      )
    }
    if (isImageSource && !videoUrl) {
      if (!posterUrl) return null
      return (
        <Img
          src={posterUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: lookCss }}
        />
      )
    }
    if (videoUrl && !mediaFailed) {
      // One code path for same-origin and remote sources. `@remotion/media`'s
      // <Video> decodes the source with the browser's own media stack, so it is
      // the component the web renderer can also extract frames AND audio from
      // (OffthreadVideo is not supported there). `muted={false}` keeps the
      // source video's audio track in the composition so it survives export;
      // playback muting stays a Player-level concern.
      return (
        <Video
          // Remote CDNs without CORS (e.g. the AI-viral demo library) are
          // streamed through the same-origin /api/media/remote proxy.
          src={toPlayablePreviewMediaUrl(videoUrl)}
          muted={false}
          onError={handleMediaError}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: lookCss }}
        />
      )
    }
    if (mediaFailed && posterUrl) {
      return (
        <Img
          src={posterUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: lookCss }}
        />
      )
    }
    return (
      <AbsoluteFill
        style={{
          background: '#0b1220',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 12,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontFamily: fontStackById(),
            color: '#dbeafe',
            fontSize: Math.round(compH * 0.045),
            fontWeight: 700,
            textAlign: 'center',
            width: '80%',
            wordBreak: 'break-word',
          }}
        >
          {brand.businessName || 'Your personalized video preview'}
        </div>
        <div
          style={{
            fontFamily: fontStackById(),
            color: 'rgba(219, 234, 254, 0.6)',
            fontSize: Math.round(compH * 0.024),
            textAlign: 'center',
            width: '80%',
          }}
        >
          Select a video or image to preview your branding
        </div>
      </AbsoluteFill>
    )
  }

  const visibleLayers = settings.layers.filter(
    (layer) =>
      layer.visible &&
      layer.kind !== 'endCard' &&
      frame >= layer.startFrame &&
      (layer.endFrame === undefined || frame <= layer.endFrame),
  )
  // The business name is on screen right now: its layer shows the brand
  // name itself (not custom text) and has faded in.
  const brandName = brand.businessName.trim().toLowerCase()
  const businessNameShown = Boolean(brandName) && visibleLayers.some(
    (layer) =>
      layer.kind === 'businessName' &&
      resolveLayerText(layer, brand).trim().toLowerCase() === brandName &&
      layer.opacity * entranceFor(layer, frame, settings.fps).opacity > 0,
  )

  const drawnFallbackText = new Set<string>()
  // Text the customer (or the layout seed) set on a layer explicitly. A layer
  // that would only fall back to that same text is the duplicate, not it.
  const ownTextLayers = new Set<string>(
    visibleLayers
      .filter((l) => (l.kind === 'headline' || l.kind === 'tagline' || l.kind === 'businessName') && ownText(l) != null)
      .map((l) => (ownText(l) as string).trim().toLowerCase()),
  )
  const { start: endCardStart, length: endCardLen } = endCardFrames(settings.durationInFrames)

  return (
    <MaybeSequenceManager>
    <AbsoluteFill style={{ background: '#05070a' }}>
      {renderBackground()}
      <LookLayers look={settings.look} />
      {audioUrl ? <Audio src={toPlayablePreviewMediaUrl(audioUrl)} /> : null}
      <AbsoluteFill
          style={{
            background: '#000',
            opacity: settings.brandColors.backgroundDim,
            pointerEvents: 'none',
          }}
        />
        {visibleLayers.map((layer) => withKeyframes(layer, (() => {
          const isImage = isImageLayerKind(layer.kind)
          const isText = TEXT_LAYER_KINDS.includes(layer.kind)
          const isDesign = layer.kind === 'design'
          if (!isImage && !isText && !isDesign) return null
          const text = isText ? resolveLayerText(layer, brand) : ''
          const imageUrl = isImage ? resolveLayerImageUrl(layer, brand) : ''
          if (isText && !text.trim()) return null
          // A headline/tagline with no text of its own that would only repeat
          // the business name already on screen isn't drawn twice.
          if (
            (layer.kind === 'headline' || layer.kind === 'tagline') &&
            ownText(layer) == null &&
            businessNameShown &&
            text.trim().toLowerCase() === brand.businessName.trim().toLowerCase()
          ) return null
          if (isImage && !imageUrl) return null
          // A headline/tagline that falls back to the SAME text an earlier
          // visible headline/tagline/name layer already draws (e.g. a layout
          // whose headline and tagline both default to the business name) is
          // a duplicate, not a second message. Own text always draws.
          if (
            (layer.kind === 'headline' || layer.kind === 'tagline') &&
            ownText(layer) == null &&
            (drawnFallbackText.has(text.trim().toLowerCase()) ||
              ownTextLayers.has(text.trim().toLowerCase()))
          ) return null
          if (isText && (layer.kind === 'headline' || layer.kind === 'tagline' || layer.kind === 'businessName')) {
            drawnFallbackText.add(text.trim().toLowerCase())
          }

          const box = toBox(layer, compW, compH, isText ? text : undefined)
          const entrance = entranceFor(layer, frame, settings.fps)
          // Text and CTA fade-and-lift out before their end frame (images have their own exit).
          const exit = isText ? exitFor(layer, frame) : { opacity: 1, translateY: 0 }
          const textColor =
            layer.color ??
            (layer.kind === 'cta' ? settings.brandColors.accent : settings.brandColors.text)
          const transformParts: string[] = []
          if (entrance.translateX) transformParts.push(`translateX(${entrance.translateX}px)`)
          if (entrance.translateY + exit.translateY) transformParts.push(`translateY(${entrance.translateY + exit.translateY}px)`)
          if (entrance.scale !== 1) transformParts.push(`scale(${entrance.scale})`)
          // Images rotate on their (explicitly sized) wrapper. Text and the CTA rotate on their own element, where the real size is
          // (their wrapper is as tall as the frame, so it would pivot about the wrong point); designs never rotate.
          const rotation = isImage ? layer.rotation : undefined
          if (rotateCss(rotation)) transformParts.push(rotateCss(rotation))

          // The layer's media role decides stacking and image fitting.
          const designForRole = isDesign && layer.designId ? getRemotionDesignTemplate(layer.designId) : undefined
          const role = roleForLayer(layer, designForRole ? { id: designForRole.id, category: designForRole.category } : null)
          const roleContract = contractFor(role)
          const layerStyle: React.CSSProperties = {
            zIndex: layerZIndex(role, visibleLayers.indexOf(layer)),
            left: box.leftPx,
            top: box.topPx,
            width: box.widthPx,
            transform: transformParts.length > 0 ? transformParts.join(' ') : undefined,
            opacity: layer.opacity * entrance.opacity * exit.opacity,
            pointerEvents: 'none',
            filter: layerEffectsFilter(layer.effects),
          }

          if (isDesign) {
            // A design renders through its own registered component. Without a
            // registered template there is nothing to draw, so the layer is
            // skipped (and the missing template is reported once).
            const design = layer.designId ? getRemotionDesignTemplate(layer.designId) : undefined
            if (!design) {
              warnMissingDesignOnce(layer.designId)
              return null
            }
            const DesignComponent = design.component
            const slots = resolveDesignTextSlots(design, layer, brand)
            const primarySlot =
              (Array.isArray(design.textSlots) ? design.textSlots : []).find(
                (slot) => slot && slot.primary,
              ) ??
              (Array.isArray(design.textSlots) ? design.textSlots : [])[0]
            const designProps = (design.defaultProps ?? {}) as Partial<RemotionDesignComponentProps>
            // The design component lives inside a Sequence so its own
            // `useCurrentFrame()` is layer-local: the design's animation
            // starts when the layer appears, not at the composition's frame 0.
            const layerFrame = Math.max(0, frame - layer.startFrame)
            const designDuration =
              layer.endFrame === undefined
                ? undefined
                : Math.max(1, layer.endFrame - layer.startFrame)
            return (
              <AbsoluteFill
                key={layer.id}
                data-remotion-design-id={design.id}
                style={{ ...layerStyle, height: box.heightPx ?? '100%' }}
              >
                <Sequence from={layer.startFrame} durationInFrames={designDuration}>
                  <DesignComponent
                    {...designProps}
                    text={primarySlot ? (slots[primarySlot.key] ?? '') : ''}
                    textSlots={slots}
                    colors={{
                      primary: settings.brandColors.primary,
                      accent: settings.brandColors.accent,
                      text: settings.brandColors.text,
                      backgroundDim: settings.brandColors.backgroundDim,
                    }}
                    media={resolveDesignMedia(design, layer, brand)}
                    box={{
                      leftPx: box.leftPx,
                      topPx: box.topPx,
                      widthPx: box.widthPx,
                      heightPx: box.heightPx ?? compH,
                    }}
                    width={compW}
                    height={compH}
                    frame={layerFrame}
                    fps={settings.fps}
                    opacity={layer.opacity}
                    color={textColor}
                    fontFamily={layer.fontFamily}
                  />
                </Sequence>
              </AbsoluteFill>
            )
          }

          if (isImage) {
            // Overlay-only styling: the file is untouched; the image's explicit role, the template
            // and the layer's own style decide how it is presented.
            const hints = settings.imageHints?.[imageUrl]
            const resolved = resolveImageLook({
              role, kind: layer.kind, layerStyle: layer.imageStyle, layerRole: layer.imageRole, hints, layout: settings.layout, aspect: settings.aspectRatio,
            })
            let style = resolved.style
            const urls = [imageUrl, ...(layer.imageUrls ?? [])].filter(Boolean)
            // A collage needs 2+ pictures; with fewer it falls back to the plain floating card.
            if (style?.presetId === 'multi-image-collage' && urls.length < 2) style = presetStyle('rounded-floating-card', settings.aspectRatio)
            const exit = style ? exitFactors(style, frame, layer.endFrame) : { opacity: 1, scale: 1 }
            const brandColors = settings.brandColors

            // Split Screen: a half-frame panel in COMPOSITION coordinates (not the layer's own box).
            if (style?.presetId === 'split-screen') {
              const side = style.splitSide ?? (compH > compW * 1.1 ? 'bottom' : 'right')
              const slide = revealFactors({ reveal: 'wipe' }, frame, layer.startFrame + (layer.animationDelay || 0))
              return (
                <AbsoluteFill key={layer.id} style={{ zIndex: layerStyle.zIndex, opacity: layer.opacity * exit.opacity * slide.progress, pointerEvents: 'none' }}>
                  <SplitPanel src={imageUrl} side={side} imageStyle={style} compWidth={compW} compHeight={compH} ImageComponent={Img as never} />
                </AbsoluteFill>
              )
            }

            const reveal = style ? revealFactors(style, frame, layer.startFrame + (layer.animationDelay || 0)) : { progress: 1, scale: 1 }
            // A reveal replaces the layer's own entrance animation.
            const boxStyle = (style?.reveal === 'wipe' || style?.reveal === 'diagonal') ? { ...layerStyle, opacity: layer.opacity, transform: rotateCss(layer.rotation) || undefined } : layerStyle
            return (
              <AbsoluteFill key={layer.id} style={{ ...boxStyle, height: box.widthPx }}>
                <div style={{ position: 'absolute', inset: 0, opacity: exit.opacity, transform: exit.scale !== 1 ? `scale(${exit.scale})` : undefined }}>
                  {style?.presetId === 'multi-image-collage' ? (
                    <ImageCollage
                      urls={urls.slice(0, 4)}
                      imageStyle={style}
                      boxWidth={box.widthPx}
                      boxHeight={box.widthPx}
                      compHeight={compH}
                      compShort={Math.min(compW, compH)}
                      brand={brandColors}
                      ImageComponent={Img as never}
                    />
                  ) : style ? (
                    <StyledBusinessImage
                      src={imageUrl}
                      imageStyle={style}
                      boxWidth={box.widthPx}
                      boxHeight={box.widthPx}
                      compHeight={compH}
                      compShort={Math.min(compW, compH)}
                      brand={brandColors}
                      aspect={hints?.aspect}
                      ImageComponent={Img as never}
                      revealProgress={reveal.progress}
                      revealScale={reveal.scale}
                    />
                  ) : (
                    <Img
                      src={imageUrl}
                      style={{ width: '100%', height: '100%', objectFit: roleContract.objectFit === 'cover' ? 'cover' : 'contain' }}
                    />
                  )}
                </div>
              </AbsoluteFill>
            )
          }

          if (layer.kind === 'cta') {
            return (
              <AbsoluteFill key={layer.id} style={layerStyle}>
                {/* Flex centering keeps a pill wider than its estimated box centered on both sides. */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <span
                    style={ctaPillStyle({
                      // The layer's color is the button color (default: accent);
                      // the label is dark or white, whichever reads on it.
                      background: textColor,
                      color: readableTextOn(textColor, PILL_TEXT_COLOR),
                      fontSizePx: box.fontSizePx,
                      fontFamily: layer.fontFamily,
                      rotation: layer.rotation,
                    })}
                  >
                    {text}
                  </span>
                </div>
              </AbsoluteFill>
            )
          }

          // A soft local scrim sits just behind the text and fades in and out with it.
          const metrics = hasTextScrim(layer.kind) ? layerBoxMetrics(layer, compW, compH, text) : null
          // A rotated row is as tall as its rotated bounding box, so the band is sized to that (same center).
          const scrimBox = metrics
            ? (() => {
                const ext = rotatedExtent(metrics.widthPx, metrics.heightPx, layer.rotation ?? 0)
                const cx = metrics.leftPx + metrics.widthPx / 2
                const cy = metrics.topPx + metrics.heightPx / 2
                return { left: cx - ext.w / 2, top: cy - ext.h / 2, width: ext.w, height: ext.h }
              })()
            : null
          // Strength adapts to the measured brightness of the footage behind this text at this moment.
          const scrimPeak = scrimBox ? scrimPeakAt(lumaSamples, scrimBox, compW, compH, frame / Math.max(1, settings.fps), textColor) : 0
          const scrim = scrimBox && scrimPeak > 0.005 ? scrimForBox(scrimBox, compW, compH) : null
          const align = textAlignFor(layer, box, compW)
          const ruleStyle = metrics
            ? accentRuleStyle(
                layer.kind, layer.animation,
                { leftPx: metrics.leftPx, topPx: metrics.topPx, widthPx: metrics.widthPx, heightPx: metrics.heightPx },
                compW, compH, settings.brandColors.accent, align, layer.rotation,
              )
            : null
          // Headlines and names enter word by word; the layer-level entrance then only drives
          // the scrim and rule, so the text is not moved twice.
          const wordMode = usesWordEntrance(layer)
          const words = text.trim().split(/\s+/).filter(Boolean)
          const entryFrame = layer.startFrame + layer.animationDelay
          const shapeOpacity = layer.opacity * entrance.opacity * exit.opacity
          const textBoxStyle: React.CSSProperties = wordMode
            ? { ...layerStyle, opacity: layer.opacity * exit.opacity, transform: exit.translateY ? `translateY(${exit.translateY}px)` : undefined }
            : layerStyle
          return (
            <React.Fragment key={layer.id}>
              {scrim ? (
                <AbsoluteFill
                  data-testid="text-scrim"
                  style={{ zIndex: layerStyle.zIndex, opacity: shapeOpacity, pointerEvents: 'none' }}
                >
                  <div style={scrimStyle(scrim, scrimPeak)} />
                </AbsoluteFill>
              ) : null}
              <AbsoluteFill style={textBoxStyle}>
                <div
                  style={layerTextStyle(layer.kind as TextStyleKind, {
                    fontSizePx: box.fontSizePx,
                    color: textColor,
                    fontFamily: layer.fontFamily,
                    align,
                    singleLine: isSingleLineBox(box.widthPx, compW),
                    rotation: layer.rotation,
                  })}
                >
                  {wordMode
                    ? words.map((word, i) => {
                        const w = wordEntrance(i, words.length, frame, entryFrame, settings.fps, box.fontSizePx)
                        return (
                          <React.Fragment key={i}>
                            {i > 0 ? ' ' : null}
                            <span
                              data-testid="entrance-word"
                              style={{ display: 'inline-block', opacity: w.opacity, transform: w.translateY ? `translateY(${w.translateY}px)` : undefined }}
                            >
                              {word}
                            </span>
                          </React.Fragment>
                        )
                      })
                    : text}
                </div>
              </AbsoluteFill>
              {ruleStyle ? (
                <AbsoluteFill
                  data-testid="headline-rule"
                  style={{ zIndex: layerStyle.zIndex, opacity: shapeOpacity, pointerEvents: 'none' }}
                >
                  <div style={ruleStyle} />
                </AbsoluteFill>
              ) : null}
            </React.Fragment>
          )
        })()))}
        {settings.showEndCard ? (
          // zIndex: layers are stacked up to stackOrder 65 * 100 + 99 (see layerZIndex), so
          // the end card needs a higher level to stay on top of layers that run to the end.
          <Sequence from={endCardStart} durationInFrames={endCardLen} style={{ zIndex: 10000 }}>
            <EndCard settings={settings} brand={brand} />
          </Sequence>
        ) : null}
      </AbsoluteFill>
    </MaybeSequenceManager>
  )
}
