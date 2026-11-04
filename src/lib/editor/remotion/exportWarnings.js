/**
 * Things the user should know before exporting with the Remotion engine.
 * Nothing is removed from the editor; these only describe the exported file.
 */
import { presentationLabel } from './transitionMap.js';

export function exportWarnings(model, { quality } = {}) {
  const warnings = [];
  if (model.skipped?.length) {
    const names = [...new Set(model.skipped.map((s) => s.label))].join(', ');
    warnings.push(`Interactive elements (${names}) stay in the editor and interactive player, but a video file can't pause, loop or take input, so they're not in the export.`);
  }
  if ((model.layers || []).some((l) => l.type === 'cta-button')) {
    warnings.push('CTA buttons appear in the exported video, but only the interactive player (Share link) makes them clickable.');
  }
  (model.transitions || []).forEach((tr) => {
    const used = tr.gpu ? tr.fallback : tr.presentation;
    if (!tr.exact || tr.gpu) {
      warnings.push(`Video transition "${tr.name}" exports as ${presentationLabel(used)}.`);
    }
    if (!tr.outgoingId || !tr.incomingId) {
      warnings.push(`Video transition "${tr.name}" isn't between two clips with media, so it blends with black.`);
    }
  });
  const missing = (model.layers || []).filter((l) => l.kind === 'overlay' && ['overlay-image', 'overlay-sticker', 'overlay-transition'].includes(l.type) && !l.options?.resolvedSrc);
  if (missing.length) warnings.push(`${missing.length} overlay(s) have no media chosen yet and will be blank.`);
  if (!(model.layers || []).some((l) => l.kind === 'video' || l.kind === 'image')) {
    warnings.push('No clips with media on the timeline yet: the background will be black.');
  }
  if (quality === '4k') warnings.push('4K renders in your browser and can take several minutes; keep this tab open and visible.');
  return [...new Set(warnings)];
}

/** Can this browser render video files locally? */
export function canExportInBrowser() {
  return typeof window !== 'undefined' && typeof window.VideoEncoder === 'function';
}
