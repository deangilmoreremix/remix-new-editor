/**
 * Free, in-browser readability checks that need no footage analysis (item: accessibility checks) and the
 * one-click fixes for them (item: "Fix this"). Pure: no DOM, no network.
 *
 * What is and is not claimed:
 *  - "text-contrast-bright" is a WORST-CASE check: the text colour against the brightest footage the
 *    brand dim could still leave behind (white darkened by `backgroundDim`). It says "may be hard to
 *    read on bright footage", never "is unreadable".
 *  - "reading-speed" compares words with how long the layer is visible. It cannot know the viewer.
 * Both are `review` severity, so they never block export.
 */
import { autoTextColor, contrastBetween, parseHex } from '../../guided/editor/colorMath';
import { layerBoxMetrics } from '../../guided/overlayGeometry';
import { endCardFrames } from '../endCard';
import { resolveLayerText } from '../layerContent';
import type { PersonalizationPreviewSettings, PreviewInputProps, PreviewLayer } from '../types';
import type { QualityIssue, QualityReport } from './types';

/** WCAG large-text minimum; the overlay type is large and bold, so this is the fair bar. */
export const MIN_CONTRAST = 3;
/** Comfortable on-screen reading speed for short overlay copy. */
export const MAX_WORDS_PER_SECOND = 3;
/** Never show a text layer for less than this, whatever its length. */
export const MIN_VISIBLE_SECONDS = 1.5;
const MAX_TEXT_LINES = 3;

const TEXT_KINDS: ReadonlySet<PreviewLayer['kind']> = new Set(['businessName', 'headline', 'tagline', 'offer', 'cta']);

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Brightest backdrop the dim can leave: white scaled by (1 - dim). */
export function worstCaseBackdrop(backgroundDim: number): string {
  const dim = Math.min(1, Math.max(0, Number.isFinite(backgroundDim) ? backgroundDim : 0));
  const v = Math.round(255 * (1 - dim)).toString(16).padStart(2, '0');
  return `#${v}${v}${v}`;
}

function textColorOf(layer: PreviewLayer, settings: PersonalizationPreviewSettings): string {
  return parseHex(layer.color) ?? parseHex(layer.kind === 'cta' ? settings.brandColors.accent : settings.brandColors.text) ?? '#ffffff';
}

/**
 * First and last frame (exclusive end) the layer is on screen. The branded end card covers the footage, so when it
 * is on the overlay is judged only before it, exactly as the placement engine does (`visibleSeconds`).
 */
function visibleFrames(layer: PreviewLayer, settings: PersonalizationPreviewSettings): [number, number] {
  const start = Math.max(0, layer.startFrame || 0);
  const cutoff = settings.showEndCard ? endCardFrames(settings.durationInFrames).start : settings.durationInFrames;
  const end = Math.min(cutoff, layer.endFrame ?? cutoff);
  return [start, Math.max(start, end)];
}

/** The text the composition really draws: the layer's own, else the brand value it falls back to. */
function shownText(layer: PreviewLayer, brand: PreviewInputProps['brand'] | undefined): string {
  return (brand ? resolveLayerText(layer, brand) : layer.text ?? '').trim();
}

export function checkAccessibility(settings: PersonalizationPreviewSettings, brand?: PreviewInputProps['brand']): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const backdrop = worstCaseBackdrop(settings.brandColors.backgroundDim);
  const fps = settings.fps > 0 ? settings.fps : 30;
  for (const layer of settings.layers) {
    if (!layer.visible || !TEXT_KINDS.has(layer.kind)) continue;
    const text = shownText(layer, brand);
    if (!text) continue;
    const [from, to] = visibleFrames(layer, settings);
    const seconds = (to - from) / fps;

    if (layer.kind !== 'cta') {
      const ratio = contrastBetween(textColorOf(layer, settings), backdrop);
      if (ratio < MIN_CONTRAST) {
        issues.push({
          code: 'text-contrast-bright', severity: 'review', layerId: layer.id, tStart: from / fps, tEnd: to / fps, fixable: false,
          message: `This text may be hard to read on bright footage (contrast ${ratio.toFixed(1)}:1 in the worst case, ${MIN_CONTRAST}:1 recommended).`,
        });
      }
    }
    const words = wordCount(text);
    const needed = Math.max(MIN_VISIBLE_SECONDS, words / MAX_WORDS_PER_SECOND);
    if (seconds < needed - 1e-6) {
      issues.push({
        code: 'reading-speed', severity: 'review', layerId: layer.id, tStart: from / fps, tEnd: to / fps, fixable: false,
        message: `${words} word${words === 1 ? '' : 's'} on screen for ${seconds.toFixed(1)} s is quick to read; about ${needed.toFixed(1)} s is comfortable.`,
      });
    }
  }
  return issues;
}

/** Adds the accessibility issues to a layout-quality report and recomputes its status. Never blocks export. */
export function withAccessibility(report: QualityReport, extra: QualityIssue[]): QualityReport {
  if (!extra.length) return report;
  const issues = [...report.issues, ...extra];
  const hasAdjust = issues.some((i) => i.severity === 'adjust' || i.severity === 'critical');
  const status = hasAdjust ? 'needs-adjustment' : 'review-required';
  return { ...report, issues, status: report.status === 'needs-adjustment' ? 'needs-adjustment' : status };
}

/**
 * One-click fix for an issue that is not a placement problem. Returns the layer patch, or null when there is
 * no safe automatic fix (then no button is shown). Never touches a locked layer.
 */
export function fixForIssue(
  issue: QualityIssue,
  settings: PersonalizationPreviewSettings,
  brand?: PreviewInputProps['brand'],
): { layerId: string; patch: Partial<PreviewLayer> } | null {
  const layer = settings.layers.find((l) => l.id === issue.layerId);
  if (!layer || layer.locked) return null;
  const fps = settings.fps > 0 ? settings.fps : 30;

  if (issue.code === 'text-contrast-bright') {
    const backdrop = worstCaseBackdrop(settings.brandColors.backgroundDim);
    const next = autoTextColor(backdrop);
    // Only offer it when it really helps.
    if (contrastBetween(next, backdrop) <= contrastBetween(textColorOf(layer, settings), backdrop)) return null;
    return { layerId: layer.id, patch: { color: next } };
  }

  if (issue.code === 'reading-speed') {
    const words = wordCount(shownText(layer, brand));
    const needFrames = Math.ceil(Math.max(MIN_VISIBLE_SECONDS, words / MAX_WORDS_PER_SECOND) * fps);
    const cutoff = settings.showEndCard ? endCardFrames(settings.durationInFrames).start : settings.durationInFrames;
    // Not enough room before the end card (or the clip) to ever show it long enough: nothing to fix by timing.
    if (cutoff < needFrames) return null;
    const start = Math.max(0, layer.startFrame || 0);
    if (start + needFrames <= cutoff) {
      const end = start + needFrames;
      return { layerId: layer.id, patch: { endFrame: end >= cutoff && !settings.showEndCard ? undefined : end } };
    }
    // Starts too late: move it earlier so it fits before the cutoff.
    return { layerId: layer.id, patch: { startFrame: Math.max(0, cutoff - needFrames), endFrame: undefined } };
  }

  if (issue.code === 'text-overflow' && shownText(layer, brand)) {
    const { width, height } = settings;
    const text = shownText(layer, brand);
    let scale = layer.scale;
    for (let i = 0; i < 12; i++) {
      const m = layerBoxMetrics({ ...layer, scale }, width, height, text);
      const lines = Math.round(m.heightPx / Math.max(1, m.fontSizePx * 1.15));
      if (lines <= MAX_TEXT_LINES) break;
      scale *= 0.9;
    }
    // Never shrink below 40% of where it was: past that the text is too small to read anyway.
    if (scale >= layer.scale || scale < layer.scale * 0.4) return null;
    // Round DOWN: rounding up could add the wrapped line back.
    return { layerId: layer.id, patch: { scale: Math.floor(scale * 1000) / 1000 } };
  }
  return null;
}
