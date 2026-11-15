'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getMediaFacts } from '@ohb/data/demoLibraryRegistry'
import { useDemoPersonalize } from '../DemoPersonalizeProvider'
import { getRemotionDesignTemplate, isRemotionDesignTemplateSupported } from '../templates/registry'
import type { PreviewInputProps } from '../preview/types'
import { seekPreviewTo } from '../preview/PreviewControls'
import {
  buildPlacementInput,
  evaluateLayoutQuality,
  measureImageAspects,
  recommendPlacement,
  recommendRestoredPlacement,
  sampleFrames,
  getCachedSamples,
  hasCachedSamples,
  setCachedSamples,
  sampleCacheKey,
  type LumaSample,
  type PlacementInput,
  type ProtectedZone,
  type QualityIssue,
  type QualityReport,
} from '../preview/placement'
import { checkAccessibility, fixForIssue, withAccessibility } from '../preview/placement/a11y'
import { splitSideFor } from '../preview/imagePresets'
import {
  compositionZones,
  profileForSource,
  rightsNeedConfirmation,
  type SourceProfile,
} from '../preview/sourceProfile'


/** Event the overlay editor listens to, to select a layer from outside (Layout Quality "Show"). */
export const SELECT_LAYER_EVENT = 'personalization:select-layer'

export type SamplingState = 'idle' | 'measuring' | 'done' | 'unavailable'

export interface LayoutQualityState {
  report: QualityReport
  profile: SourceProfile
  sampling: SamplingState
  /** Composition-space zones in effect (verified source zones + baked-in + customer-marked). */
  zones: ProtectedZone[]
  rightsNeedConfirmation: boolean
  /** Moves the preview to a time and selects the layer in the editor. */
  show: (layerId: string | undefined, tSeconds: number | undefined) => void
  /** Applies the engine's recommendation, optionally to a single layer. Never moves locked/hand-placed layers. */
  applyRecommended: (layerId?: string) => number
  /** Restore Recommended Placement: template position + footage adjustments; replaces hand placement, never locked layers. */
  restoreRecommended: () => number
  /** True when a one-click fix exists for an issue the placement engine cannot fix (contrast colour, reading time, text size). */
  canFixIssue: (issue: QualityIssue) => boolean
  /** Applies that fix to the layer. Returns whether anything changed. */
  applyIssueFix: (issue: QualityIssue) => boolean
  /** Customer marks where the subject is (composition space), or clears it. */
  markSubject: (where: 'left' | 'center' | 'right' | 'clear') => void
}

const EMPTY_BRAND: PreviewInputProps['brand'] = {
  businessName: '', headline: '', offer: '', cta: '', phone: '', website: '', logoUrl: null, productUrl: null, serviceUrl: null,
}

const SUBJECT_ZONES: Record<'left' | 'center' | 'right', Omit<ProtectedZone, 'id' | 'label' | 'source'>> = {
  left: { x: 0.02, y: 0.08, w: 0.34, h: 0.84 },
  center: { x: 0.33, y: 0.08, w: 0.34, h: 0.84 },
  right: { x: 0.64, y: 0.08, w: 0.34, h: 0.84 },
}

export function useLayoutQuality(inputProps: PreviewInputProps): LayoutQualityState {
  const ctx = useDemoPersonalize()
  const { previewSettings: settings, source, setPreviewProtectedZones, applyPreviewPlacements, updatePreviewLayer } = ctx
  const brand = inputProps?.brand ?? EMPTY_BRAND
  const videoUrl = inputProps?.videoUrl ?? null
  const isImageSource = Boolean(inputProps?.isImageSource)

  const [samples, setSamples] = useState<LumaSample[]>([])
  const [sampling, setSampling] = useState<SamplingState>('idle')
  const [aspects, setAspects] = useState<Record<string, number>>({})

  useEffect(() => {
    let live = true
    if (!videoUrl || isImageSource) { setSamples([]); setSampling('idle'); return }
    // The footage is shown with objectFit: 'cover', so it is measured on that crop; the same clip in a
    // different frame shape is a different measurement (shared cache keyed by URL + frame shape).
    const cacheKey = sampleCacheKey(videoUrl, settings.width, settings.height) as string
    if (hasCachedSamples(cacheKey)) {
      const cached = getCachedSamples(cacheKey)
      setSamples(cached ?? []); setSampling(cached ? 'done' : 'unavailable'); return
    }
    setSampling('measuring')
    void sampleFrames(videoUrl, { composition: { width: settings.width, height: settings.height } }).then((res) => {
      setCachedSamples(cacheKey, res?.samples ?? null)
      if (!live) return
      setSamples(res?.samples ?? []); setSampling(res ? 'done' : 'unavailable')
    })
    return () => { live = false }
  }, [videoUrl, isImageSource, settings.width, settings.height])

  const imageUrls = [brand.logoUrl, brand.productUrl, brand.serviceUrl, ...settings.layers.map((l) => l.imageUrl)]
    .filter((u): u is string => !!u)
    .join('|')
  useEffect(() => {
    let live = true
    const urls = imageUrls ? imageUrls.split('|') : []
    if (!urls.length) { setAspects({}); return }
    void measureImageAspects(urls).then((a) => { if (live) setAspects(a) })
    return () => { live = false }
  }, [imageUrls])

  // The profile follows the video that is actually previewed/rendered: a demo picked
  // in Step 2 lives in the preview video, not in `source.sourceMedia`.
  const sourcePath =
    typeof videoUrl === 'string' && videoUrl
      ? videoUrl
      : typeof source?.sourceMedia === 'string'
        ? source.sourceMedia
        : null
  const profile = useMemo(() => {
    const facts = sourcePath ? getMediaFacts(sourcePath) : undefined
    return profileForSource({ videoSrc: sourcePath, title: source?.title, width: facts?.width, height: facts?.height })
  }, [sourcePath, source?.title])

  const zones = useMemo(
    // 'cover': PersonalizationComposition fills the frame with the footage (objectFit: 'cover'), so the
    // subject zones must be mapped with the same crop, not the letterboxed 'contain' default.
    () => [...compositionZones(profile, settings.width, settings.height, 'cover'), ...(settings.protectedZones ?? [])],
    [profile, settings.width, settings.height, settings.protectedZones],
  )

  const input: PlacementInput = useMemo(
    () =>
      buildPlacementInput({
        settings,
        brand,
        zones,
        samples,
        imageAspects: aspects,
        source: { rights: profile.rights, rightsNote: profile.rightsNote, bakedStatus: profile.baked.status },
        designFacts: (id) => {
          const d = getRemotionDesignTemplate(id)
          return d ? { id: d.id, category: d.category, supported: isRemotionDesignTemplateSupported(id, settings.aspectRatio).supported } : undefined
        },
      }),
    [settings, brand, zones, samples, aspects, profile],
  )

  // Free readability checks (worst-case contrast, reading speed) join the placement report; review-only, never blocking.
  const report = useMemo(() => withAccessibility(evaluateLayoutQuality(input), checkAccessibility(settings, brand)), [input, settings, brand])

  // With a VERIFIED subject area (a reviewed clip or one the customer marked), the
  // recommended placement is applied automatically so the default layout does not
  // sit on the subject. It runs once per (layout, shape, video, zones, assigned images)
  // and never moves hand-placed or locked layers. Without a verified area nothing is
  // moved: that stays "Review required" and the customer decides.
  const autoKeyRef = useRef<string>('')
  const autoKey = [
    settings.layout, settings.aspectRatio, videoUrl ?? '', imageUrls, sampling === 'measuring' ? 'm' : 'r',
    zones.map((z) => `${z.id}:${z.x.toFixed(3)},${z.y.toFixed(3)},${z.w.toFixed(3)},${z.h.toFixed(3)}`).join(';'),
  ].join('|')
  useEffect(() => {
    if (sampling === 'measuring' || zones.length === 0) return
    if (autoKeyRef.current === autoKey) return
    autoKeyRef.current = autoKey
    const result = recommendPlacement(input)
    const items = result.proposals.filter((p) => p.moved)
    if (items.length) applyPreviewPlacements(items)
    // Split Screen takes the side that overlaps the verified subject least. A side the customer
    // chose explicitly (no `splitSideAuto`) is never overridden.
    const side = splitSideFor(zones, settings.width, settings.height)
    for (const layer of settings.layers) {
      const st = layer.imageStyle
      if (st?.presetId !== 'split-screen') continue
      if (st.splitSide && st.splitSideAuto !== true) continue
      if (st.splitSide === side) continue
      updatePreviewLayer(layer.id, { imageStyle: { ...st, splitSide: side, splitSideAuto: true } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey])

  const show = useCallback((layerId: string | undefined, t: number | undefined) => {
    if (typeof t === 'number' && Number.isFinite(t)) seekPreviewTo(Math.round(t * settings.fps))
    if (layerId && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SELECT_LAYER_EVENT, { detail: { layerId } }))
  }, [settings.fps])

  const applyRecommended = useCallback((layerId?: string) => {
    const result = recommendPlacement(input)
    const items = result.proposals.filter((p) => p.moved && (!layerId || p.layerId === layerId))
    if (items.length) applyPreviewPlacements(items)
    return items.length
  }, [input, applyPreviewPlacements])

  const restoreRecommended = useCallback(() => {
    const result = recommendRestoredPlacement(input)
    applyPreviewPlacements(result.proposals, { overrideManual: true })
    return result.proposals.length
  }, [input, applyPreviewPlacements])

  const canFixIssue = useCallback((issue: QualityIssue) => fixForIssue(issue, settings, brand) !== null, [settings, brand])
  const applyIssueFix = useCallback((issue: QualityIssue) => {
    const fix = fixForIssue(issue, settings, brand)
    if (!fix) return false
    updatePreviewLayer(fix.layerId, fix.patch)
    return true
  }, [settings, brand, updatePreviewLayer])

  const markSubject = useCallback((where: 'left' | 'center' | 'right' | 'clear') => {
    const others = (settings.protectedZones ?? []).filter((z) => z.id !== 'customer-subject')
    if (where === 'clear') { setPreviewProtectedZones(others); return }
    setPreviewProtectedZones([...others, { id: 'customer-subject', label: 'Subject you marked', source: 'user', ...SUBJECT_ZONES[where] }])
  }, [settings.protectedZones, setPreviewProtectedZones])

  return { report, profile, sampling, zones, rightsNeedConfirmation: rightsNeedConfirmation(profile), show, applyRecommended, restoreRecommended, markSubject, canFixIssue, applyIssueFix }
}
