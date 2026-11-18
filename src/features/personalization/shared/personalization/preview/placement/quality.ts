/**
 * Layout Quality Check.
 *
 * Evaluates the layers exactly as they are positioned now, against the facts the
 * customer's project actually has: protected zones, measured luminance samples,
 * the layers' boxes and their on-screen time. Three outcomes:
 *
 *  - Ready               every check that can run passed, and nothing was unverifiable
 *  - Needs Adjustment    a known layout problem was found
 *  - Review Required     the system cannot evaluate something (unknown subject area,
 *                        no frame measurements, duplicated copy) — it does NOT say "fine"
 *
 * Only CONFIRMED critical rendering failures (a required image that is missing or
 * has an invalid address, a design that cannot render here) block export. A visible
 * image layer with no image at all only warns: it draws nothing and breaks nothing. Subjective
 * layout concerns never do.
 */
import { layerBoxMetrics } from '../../guided/overlayGeometry'
import { contractFor } from '../mediaRoles'
import {
  inflate,
  area,
  intersectionArea,
  outsideSafeArea,
  splitPanelRect,
  hexLuminance,
  zoneToPx,
} from './geometry'
import { boxOf, samplesFor, visibleSeconds, worstContrast } from './engine'
import { hasTextScrim, peakFromLuminance, scrimAlphaOverBox, scrimForBox } from '../scrim'
import type { PlacementInput, PlacementLayer, QualityIssue, QualityReport } from './types'

const MIN_CONTRAST = 3
const COLLISION_RATIO = 0.15
const SUBJECT_RATIO = 0.1
const MAX_TEXT_LINES = 3

const VALID_URL = /^(https?:\/\/|data:image\/|blob:|\/)/i

export const BAKED_IN_NOTE =
  'Graphics already baked into the source video (its own text, logos or watermarks) cannot be detected or removed by overlays. If your footage has any, check them yourself.'

function movable(l: PlacementLayer): boolean {
  return contractFor(l.role).autoPlaceable && !l.layer.locked && l.layer.placementSource !== 'manual'
}

export function evaluateLayoutQuality(input: PlacementInput): QualityReport {
  const { width, height } = input
  const issues: QualityIssue[] = []
  const isImageRole = (l: PlacementLayer) => l.role === 'logo' || l.role === 'product-image' || l.role === 'service-image'
  // A layer that draws nothing (an image layer with no image) is reported once as
  // missing media, but never takes part in box checks: there is nothing to collide.
  const visible = input.layers.filter((l) => l.layer.visible)
  const drawn = visible.filter((l) => !isImageRole(l) || (l.imageUrl ?? '').trim() !== '')
  const boxes = new Map(drawn.map((l) => [l.layer.id, boxOf(l.layer, l.text, l.layer.x, l.layer.y, width, height, l.imageAspect)]))
  const window = (l: PlacementLayer) => visibleSeconds(l.layer, input.fps, input.durationInFrames, input.endCardStartFrame)
  const dur = (l: PlacementLayer) => ({ tStart: window(l)[0], tEnd: window(l)[1] })

  for (const l of visible) {
    const contract = contractFor(l.role)
    const isImage = isImageRole(l)

    // ── critical: the element cannot render ─────────────────────────────
    if (isImage) {
      const url = (l.imageUrl ?? '').trim()
      if (!url) {
        // Nothing renders for this layer, but nothing is broken either: the
        // layout simply has no image yet. Tell the customer; do not block.
        issues.push({ code: 'missing-media', severity: 'adjust', layerId: l.layer.id, ...dur(l), fixable: false,
          message: `${contract.label} has no image, so it will not appear in the video. Add one or hide the layer.` })
      } else if (!VALID_URL.test(url)) {
        issues.push({ code: 'missing-media', severity: 'critical', layerId: l.layer.id, ...dur(l), fixable: false,
          message: `${contract.label} points to an image address that cannot be loaded.` })
      }
    }
    if (l.layer.kind === 'design' && l.designSupported === false) {
      issues.push({ code: 'unsupported-design', severity: 'critical', layerId: l.layer.id, ...dur(l), fixable: false,
        message: 'This design cannot be rendered for the current video shape. Choose another design or video shape.' })
    }

    // A design owns its own box (often the whole frame): box checks do not apply.
    if (l.layer.kind === 'design') continue
    const box = boxes.get(l.layer.id)
    if (!box) continue // draws nothing

    // ── adjustments ─────────────────────────────────────────────────────
    if (contract.clampToSafeArea && outsideSafeArea(box, width, height)) {
      issues.push({ code: 'off-frame', severity: 'adjust', layerId: l.layer.id, ...dur(l), fixable: movable(l),
        message: `${contract.label} runs past the edge of the video.` })
    }
    if (!contract.mayCoverSubject) {
      for (const z of input.zones) {
        const ov = intersectionArea(inflate(box, l.bleedPx ?? 0), zoneToPx(z, width, height))
        if (ov / Math.max(1, area(box)) > SUBJECT_RATIO) {
          issues.push({
            code: isImage && l.role !== 'logo' ? 'media-over-subject' : 'text-over-subject',
            severity: 'adjust', layerId: l.layer.id, ...dur(l), fixable: movable(l),
            message: `${contract.label} covers “${z.label}”.`,
          })
          break
        }
      }
    }
    if (l.text) {
      const m = layerBoxMetrics(l.layer, width, height, l.text)
      const lines = Math.round(m.heightPx / Math.max(1, m.fontSizePx * 1.15))
      if (lines > MAX_TEXT_LINES) {
        issues.push({ code: 'text-overflow', severity: 'adjust', layerId: l.layer.id, ...dur(l), fixable: false,
          message: `${contract.label} wraps onto ${lines} lines. Shorten the text.` })
      }
      if (input.samples.length) {
        // The composition draws a soft scrim behind these text kinds; credit it, but only
        // the weakest alpha the box gets (and nothing for text kinds that draw none).
        const textColor = l.layer.color ?? input.textColor
        const band = scrimForBox(box, width, height)
        // The scrim's strength follows the footage luminance behind the text, exactly as the render draws it.
        const alphaFor = hasTextScrim(l.layer.kind)
          ? (lum: number) => scrimAlphaOverBox(band, box, peakFromLuminance(lum, hexLuminance(textColor)))
          : () => 0
        const wc = worstContrast(box, samplesFor(input.samples, window(l)), width, height, textColor, 0, alphaFor)
        if (wc && wc.ratio < MIN_CONTRAST) {
          issues.push({ code: 'low-contrast', severity: 'adjust', layerId: l.layer.id, tStart: wc.t, tEnd: window(l)[1], fixable: movable(l),
            message: `${contract.label} is hard to read at ${wc.t.toFixed(1)} s (contrast ${wc.ratio.toFixed(1)}:1).` })
        }
      }
    }
  }

  // collisions between overlays that should not overlap
  for (let i = 0; i < drawn.length; i++) {
    for (let j = i + 1; j < drawn.length; j++) {
      const a = drawn[i]
      const b = drawn[j]
      if (a.layer.kind === 'design' || b.layer.kind === 'design') continue
      if (contractFor(a.role).mayCoverSubject || contractFor(b.role).mayCoverSubject) continue
      const [as, ae] = window(a)
      const [bs, be] = window(b)
      if (Math.max(as, bs) > Math.min(ae, be)) continue
      const ba0 = boxes.get(a.layer.id)
      const bb0 = boxes.get(b.layer.id)
      if (!ba0 || !bb0) continue
      const ba = inflate(ba0, a.bleedPx ?? 0) // shadows count as occupied space
      const bb = inflate(bb0, b.bleedPx ?? 0)
      const ov = intersectionArea(ba, bb)
      if (ov / Math.max(1, Math.min(area(ba), area(bb))) > COLLISION_RATIO) {
        issues.push({ code: 'overlay-collision', severity: 'adjust', layerId: b.layer.id,
          tStart: Math.max(as, bs), tEnd: Math.min(ae, be), fixable: movable(a) || movable(b),
          message: `${contractFor(b.role).label} overlaps ${contractFor(a.role).label.toLowerCase()}.` })
      }
    }
  }

  // split-screen panels cover half the frame on purpose: say so, and check the side against the subject
  for (const l of visible.filter((x) => x.presetId === 'split-screen')) {
    const panel = splitPanelRect(l.splitSide, width, height)
    // text and logos must not sit on the picture half (the video half is where they belong)
    for (const t of drawn) {
      if (t.layer.id === l.layer.id || t.layer.kind === 'design' || t.role === 'product-image' || t.role === 'service-image') continue
      const tb = boxes.get(t.layer.id)
      if (tb && intersectionArea(tb, panel) / Math.max(1, area(tb)) > 0.2) {
        issues.push({ code: 'overlay-collision', severity: 'adjust', layerId: t.layer.id, ...dur(t), fixable: movable(t),
          message: `${contractFor(t.role).label} sits on the Split Screen picture. Move it to the video side.` })
      }
    }
    if (input.zones.length === 0) {
      issues.push({ code: 'split-covers-footage', severity: 'review', layerId: l.layer.id, ...dur(l), fixable: false,
        message: 'Split Screen covers half of the video, and the subject area is not marked, so it cannot be checked. Look at the preview, or mark the subject.' })
    } else {
      const covered = input.zones.some((z) => intersectionArea(panel, zoneToPx(z, width, height)) / Math.max(1, area(zoneToPx(z, width, height))) > 0.25)
      if (covered) {
        issues.push({ code: 'split-covers-footage', severity: 'adjust', layerId: l.layer.id, ...dur(l), fixable: false,
          message: 'The Split Screen panel covers the subject. Use the other side.' })
      }
    }
  }

  // too crowded: picture overlays together take too much of the frame (or there are too many)
  // A Split Screen panel is a deliberate half-frame layout, not a stray overlay: it is judged by its own rule.
  const pictures = drawn.filter((l) => (l.role === 'product-image' || l.role === 'service-image') && l.presetId !== 'split-screen')
  const pictureArea = pictures.reduce((sum, l) => {
    const b = boxes.get(l.layer.id)
    return sum + (b ? area(b) : 0)
  }, 0)
  if (pictures.length > 3 || pictureArea / (width * height) > 0.45) {
    issues.push({ code: 'overlay-crowded', severity: 'adjust', fixable: false,
      message: 'Too many or too large picture overlays for this scene. Hide one or use a smaller style.' })
  }

  // identical copy typed on two text layers
  const seen = new Map<string, PlacementLayer>()
  for (const l of visible) {
    if (l.role !== 'text' || !l.text.trim() || typeof l.layer.text !== 'string' || !l.layer.text.trim()) continue
    const key = l.text.trim().toLowerCase()
    const prev = seen.get(key)
    if (prev) {
      issues.push({ code: 'duplicate-text', severity: 'review', layerId: l.layer.id, ...dur(l), fixable: false,
        message: 'Two text layers say the same thing. Remove one if that is not intended.' })
    } else seen.set(key, l)
  }

  // ── review: things that cannot be verified ───────────────────────────
  const needsSubject = drawn.some((l) => !contractFor(l.role).mayCoverSubject)
  if (needsSubject && input.zones.length === 0) {
    issues.push({ code: 'subject-unknown', severity: 'review', fixable: false,
      message: 'The subject area of the footage is not marked, so text and images cannot be checked against it. Mark where the subject is.' })
  }
  if (visible.some((l) => l.text) && input.samples.length === 0) {
    issues.push({ code: 'contrast-unverified', severity: 'review', fixable: false,
      message: 'Text readability could not be measured on this footage. Check it in the preview.' })
  }

  if (input.source) {
    if (input.source.bakedStatus === 'unknown') {
      issues.push({ code: 'baked-in-unknown', severity: 'review', fixable: false,
        message: 'Nobody has checked this video for text, logos or watermarks already baked into it. Overlays cannot remove them — check the preview.' })
    }
    if (input.source.rights === 'unverified' || input.source.rights === 'third-party-reference') {
      issues.push({ code: 'rights-unverified', severity: 'review', fixable: false, message: input.source.rightsNote })
    }
  }

  const hasCritical = issues.some((i) => i.severity === 'critical')
  const hasAdjust = issues.some((i) => i.severity === 'adjust')
  const hasReview = issues.some((i) => i.severity === 'review')
  return {
    status: hasCritical || hasAdjust ? 'needs-adjustment' : hasReview ? 'review-required' : 'ready',
    issues,
    blocksExport: hasCritical,
    notes: [BAKED_IN_NOTE],
    analysis: {
      protectedZones: input.zones.length,
      frameSamples: input.samples.length,
      subjectVerified: input.zones.length > 0,
      contrastVerified: input.samples.length > 0,
    },
  }
}
