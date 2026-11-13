import { applyCustomFields, rotationCss, sourceMediaStyle } from './layerTransform'
import { WebsiteBackgroundLayer } from './WebsiteBackgroundLayer'
import { PresenterLayer } from './PresenterLayer'
import { FootageFrame } from './FootageFrame'
import { fadeCoverAt } from './videoEffects'
import { TEXT_LAYER_KINDS as LAYER_TEXT_KINDS, exitFactorsAt, newEntranceFactors, textEffectStyle, type NewEntranceId } from './layerEffects'
import { audioPlan } from './audioMix'
import { resolveMatteUrl, subscribeMatteRegistry } from './presenterMatteRegistry'
import { contractFor, layerZIndex, roleForLayer } from './mediaRoles'
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
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { Video, Audio } from '@remotion/media'
import { fontStackById, isImageLayerKind, toBox } from './presets'
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
  PreviewAnimationId,
  PreviewInputProps,
  PreviewLayer,
  PersonalizationPreviewSettings,
} from './types'

const TEXT_LAYER_KINDS: PreviewLayer['kind'][] = [...LAYER_TEXT_KINDS]

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
 * `Internals.SequenceManager` only exists in some Remotion versions. The pinned
 * 4.0.540 does not export it (only `SequenceManagerProvider`), and reading
 * `.Provider` off `undefined` crashed the whole composition in a real browser
 * (Player and web-renderer export alike) while jsdom tests, which mock it, kept
 * passing. The no-op provider is a test-only workaround, so it is used when the
 * runtime offers it and skipped otherwise.
 */
const SequenceManagerBoundary: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const Provider = (Internals as unknown as {
    SequenceManager?: { Provider?: React.ComponentType<{ value: unknown; children?: React.ReactNode }> }
  }).SequenceManager?.Provider
  return Provider ? <Provider value={NOOP_SEQUENCE_MANAGER}>{children}</Provider> : <>{children}</>
}

interface EntranceState {
  opacity: number
  scale: number
  translateX: number
  translateY: number
  /** Gaussian blur in px (the `blur-in` entrance). */
  blurPx?: number
}

/**
 * Frame-local entrance progress. Spring-based animations read progress from
 * `startFrame + animationDelay`; fade/slide animations ease across 15 frames.
 */
function entranceFor(layer: PreviewLayer, frame: number, fps: number): EntranceState {
  const entryStart = layer.startFrame + layer.animationDelay
  const eased = interpolate(frame, [entryStart, entryStart + 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })
  const springProgress = spring({
    frame: Math.max(0, frame - entryStart),
    fps: Math.max(1, fps),
    config: { damping: 200 },
  })

  const animation: PreviewAnimationId = layer.animation
  switch (animation) {
    case 'none':
      return { opacity: 1, scale: 1, translateX: 0, translateY: 0 }
    case 'fade':
      return { opacity: eased, scale: 1, translateX: 0, translateY: 0 }
    case 'slide-up':
      return { opacity: eased, scale: 1, translateX: 0, translateY: (1 - eased) * 40 }
    case 'slide-down':
      return { opacity: eased, scale: 1, translateX: 0, translateY: -(1 - eased) * 40 }
    case 'slide-left':
      return { opacity: eased, scale: 1, translateX: (1 - eased) * 60, translateY: 0 }
    case 'pop':
      return { opacity: eased, scale: 0.6 + 0.4 * springProgress, translateX: 0, translateY: 0 }
    case 'logo-reveal':
      return { opacity: eased, scale: 0.85 + 0.15 * springProgress, translateX: 0, translateY: 0 }
    case 'lower-third':
      return { opacity: eased, scale: 1, translateX: -(1 - eased) * 30, translateY: 0 }
    case 'cta-pulse': {
      const pulse = interpolate(Math.sin((frame - entryStart) / 6), [-1, 1], [0.97, 1.03])
      return { opacity: eased, scale: pulse, translateX: 0, translateY: 0 }
    }
    case 'blur-in':
    case 'zoom-in':
      return newEntranceFactors(animation as NewEntranceId, eased, springProgress)
    case 'bounce':
      // A lively spring (low damping) so it overshoots and settles.
      return newEntranceFactors('bounce', eased, spring({ frame: Math.max(0, frame - entryStart), fps: Math.max(1, fps), config: { damping: 9, stiffness: 120 } }))
    default:
      return { opacity: eased, scale: 1, translateX: 0, translateY: 0 }
  }
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

  return (
    <AbsoluteFill
      style={{
        background: settings.brandColors.primary,
        opacity: 0.92 * fade,
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
          }}
        />
      ) : null}
      {brand.businessName ? (
        <div
          style={{
            fontFamily: fontStackById(),
            color: PILL_TEXT_COLOR,
            fontSize: Math.round(settings.height * 0.055),
            fontWeight: 800,
            lineHeight: 1.15,
            textAlign: 'center',
            wordBreak: 'break-word',
            width: '90%',
          }}
        >
          {brand.businessName}
        </div>
      ) : null}
      {contactLine ? (
        <div
          style={{
            fontFamily: fontStackById(),
            color: PILL_TEXT_COLOR,
            fontSize: Math.round(settings.height * 0.032),
            fontWeight: 600,
            lineHeight: 1.2,
            textAlign: 'center',
          }}
        >
          {contactLine}
        </div>
      ) : null}
      {ctaText ? (
        <div style={{ width: '100%', textAlign: 'center' }}>
          <span
            style={{
              background: settings.brandColors.accent,
              color: PILL_TEXT_COLOR,
              padding: '0.4em 1.1em',
              borderRadius: 999,
              display: 'inline-block',
              fontFamily: fontStackById(),
              fontSize: Math.round(settings.height * 0.036),
              fontWeight: 800,
            }}
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

  // Processed footage / mixdown URLs are registered after the first paint (restored from the local store after a
  // reload, or just baked): re-render when the registry changes so the Player and the export pick them up.
  const [, setMediaRegistryVersion] = useState(0)
  useEffect(() => subscribeMatteRegistry(() => setMediaRegistryVersion((v) => v + 1)), [])

  // Audio (Stage 4): with a current mixdown, play it and mute every source; otherwise the sources play as they are.
  const mix = settings.audioMix
  const mixdownUrl = mix?.mixdown ? resolveMatteUrl({ key: mix.mixdown.key }) : null
  const audioDecision = audioPlan(mix, isImageSource ? null : videoUrl, audioUrl, settings.durationInFrames / (settings.fps > 0 ? settings.fps : 30), mixdownUrl)

  // A presenter (camera bubble, PiP, cut-out…) replaces the full-frame source video. If the media failed to
  // load, the existing poster fallback is used instead.
  const presenterActive = Boolean(settings.presenter?.enabled && videoUrl && !isImageSource && !mediaFailed)

  const renderBackground = () => {
    if (isImageSource && !videoUrl) {
      if (!posterUrl) return null
      return (
        <Img
          src={posterUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover', ...sourceMediaStyle(settings.sourceTransform) }}
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
        <FootageFrame effects={settings.footageEffects} frame={frame} totalFrames={settings.durationInFrames} compW={compW} compH={compH}>
        <Video
          // Remote CDNs without CORS (e.g. the AI-viral demo library) are
          // streamed through the same-origin /api/media/remote proxy.
          src={toPlayablePreviewMediaUrl(videoUrl)}
          muted={audioDecision.useMixdown}
          // objectFit is a PROP of @remotion/media's <Video>; the CSS object-fit below is ignored by its canvas
          // (found in Stage 3: a portrait clip in a landscape frame was letterboxed, not covered).
          objectFit="cover"
          onError={handleMediaError}
          style={{ width: '100%', height: '100%', objectFit: 'cover', ...sourceMediaStyle(settings.sourceTransform) }}
        />
        </FootageFrame>
      )
    }
    if (mediaFailed && posterUrl) {
      return (
        <Img
          src={posterUrl}
          style={{ width: '100%', height: '100%', objectFit: 'cover', ...sourceMediaStyle(settings.sourceTransform) }}
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
    <SequenceManagerBoundary>
    <AbsoluteFill style={{ background: '#05070a' }} data-audio-source={audioDecision.useMixdown ? 'mixdown' : 'sources'}>
      {presenterActive ? (
        // The presenter is drawn above the website, so the video is not the full-frame background here.
        <AbsoluteFill style={{ background: `linear-gradient(135deg, ${settings.brandColors.primary}, #05070a)` }} />
      ) : renderBackground()}
      {settings.websiteBackground ? (
        <WebsiteBackgroundLayer background={settings.websiteBackground} frame={frame} compW={compW} compH={compH} accent={settings.brandColors.accent} />
      ) : null}
      {presenterActive && videoUrl ? (
        <PresenterLayer presenter={settings.presenter as NonNullable<typeof settings.presenter>} videoUrl={toPlayablePreviewMediaUrl(videoUrl)} compW={compW} compH={compH} muteSources={audioDecision.useMixdown} effects={settings.footageEffects} totalFrames={settings.durationInFrames} />
      ) : null}
      {audioDecision.useMixdown && mixdownUrl ? <Audio src={mixdownUrl} data-audio-mixdown="" /> : audioUrl ? <Audio src={toPlayablePreviewMediaUrl(audioUrl)} /> : null}
      <AbsoluteFill
          style={{
            background: '#000',
            opacity: settings.brandColors.backgroundDim,
            pointerEvents: 'none',
          }}
        />
        {visibleLayers.map((layer) => {
          const isImage = isImageLayerKind(layer.kind)
          const isText = TEXT_LAYER_KINDS.includes(layer.kind)
          const isDesign = layer.kind === 'design'
          if (!isImage && !isText && !isDesign) return null
          const text = isText ? applyCustomFields(resolveLayerText(layer, brand), settings.customFields) : ''
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
          const leaving = exitFactorsAt(layer.exit, frame, layer.endFrame)
          const textColor =
            layer.color ??
            (layer.kind === 'cta' ? settings.brandColors.accent : settings.brandColors.text)
          const isExtraBold = layer.kind === 'businessName' || layer.kind === 'cta'
          const transformParts: string[] = []
          const tx = entrance.translateX + leaving.translateX
          const ty = entrance.translateY + leaving.translateY
          const sc = entrance.scale * leaving.scale
          if (tx) transformParts.push(`translateX(${tx}px)`)
          if (ty) transformParts.push(`translateY(${ty}px)`)
          if (sc !== 1) transformParts.push(`scale(${sc})`)
          // Rotation is the customer's own placement. Designs are full-frame and are
          // never rotated. An image's box is square, so it rotates about its centre
          // right here; a text layer's wrapper is frame-tall (an AbsoluteFill), so it
          // is rotated on the auto-height element inside it instead — otherwise the
          // pivot would be the middle of the frame-tall box, far from the text, and
          // the text would swing away. That inner element is the same box the editor
          // stage rotates, so preview, stage and export agree.
          const rotate = isDesign ? '' : rotationCss(layer.rotation)
          if (rotate && isImage) transformParts.push(rotate)

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
            opacity: layer.opacity * entrance.opacity * leaving.opacity,
            filter: entrance.blurPx ? `blur(${Math.round(entrance.blurPx * 100) / 100}px)` : undefined,
            pointerEvents: 'none',
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
            const boxStyle = (style?.reveal === 'wipe' || style?.reveal === 'diagonal') ? { ...layerStyle, opacity: layer.opacity, transform: rotate || undefined } : layerStyle
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
                <div style={{ width: '100%', textAlign: 'center', transform: rotate || undefined }}>
                  <span
                    style={{
                      // The layer's color is the button color (default: accent);
                      // the label is dark or white, whichever reads on it.
                      background: textColor,
                      color: readableTextOn(textColor, PILL_TEXT_COLOR),
                      padding: '0.4em 1.1em',
                      borderRadius: 999,
                      display: 'inline-block',
                      fontFamily: fontStackById(layer.fontFamily),
                      fontSize: box.fontSizePx,
                      fontWeight: 800,
                    }}
                  >
                    {text}
                  </span>
                </div>
              </AbsoluteFill>
            )
          }

          return (
            <AbsoluteFill key={layer.id} style={layerStyle}>
              <div
                style={{
                  fontFamily: fontStackById(layer.fontFamily),
                  color: textColor,
                  fontSize: box.fontSizePx,
                  fontWeight: isExtraBold ? 800 : 600,
                  lineHeight: 1.15,
                  textAlign: 'center',
                  width: '100%',
                  // Only break a word that cannot fit on a line by itself;
                  // `wordBreak: 'break-word'` split ordinary words mid-word.
                  overflowWrap: 'break-word',
                  transform: rotate || undefined,
                  ...textEffectStyle(layer.effect, box.fontSizePx),
                }}
              >
                {text}
              </div>
            </AbsoluteFill>
          )
        })}
        {settings.footageEffects?.fade && fadeCoverAt(frame, settings.footageEffects.fade, settings.durationInFrames) > 0 ? (
          <AbsoluteFill data-footage-fade="" style={{ background: '#000', opacity: fadeCoverAt(frame, settings.footageEffects.fade, settings.durationInFrames), zIndex: 20000, pointerEvents: 'none' }} />
        ) : null}
        {settings.showEndCard ? (
          // zIndex: layers are stacked up to stackOrder 65 * 100 + 99 (see layerZIndex), so
          // the end card needs a higher level to stay on top of layers that run to the end.
          <Sequence from={endCardStart} durationInFrames={endCardLen} style={{ zIndex: 10000 }}>
            <EndCard settings={settings} brand={brand} />
          </Sequence>
        ) : null}
      </AbsoluteFill>
    </SequenceManagerBoundary>
  )
}
