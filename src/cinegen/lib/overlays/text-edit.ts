// [remix] Click-to-edit text on the form (viewer): turns "this option key now has this text" into the overlay update.
// List Builder keeps its config object; the Lead Generator keeps the flat clip the old editor saved (through the shared adapter).
import type { OverlayClip } from '@cinegen/types/workspace';
// @ts-expect-error plain JS settings helpers
import { setPath } from '../../../lib/editor/addons/addonEditor.js';
// @ts-expect-error plain JS opt-in form config helpers
import { leadFormToOptin, applyOptinToLeadForm, normalizeListBuilder } from '../../../lib/editor/addons/listBuilder.js';

export function textEditUpdates(overlay: OverlayClip, key: string, value: string): Partial<OverlayClip> {
  if (overlay.type === 'list-builder') {
    const config = normalizeListBuilder(JSON.parse(JSON.stringify(overlay.config ?? {}))) as Record<string, unknown>;
    setPath(config, key, value);
    return { config };
  }
  if (overlay.type === 'lead-form') {
    const options = JSON.parse(JSON.stringify(leadFormToOptin(overlay))) as Record<string, unknown>;
    setPath(options, key, value);
    const clip = { ...overlay, style: { ...((overlay.style as object) ?? {}) }, design: { ...((overlay.design as object) ?? {}) } } as Record<string, unknown>;
    applyOptinToLeadForm(clip, options);
    const { id: _id, type: _type, start: _start, end: _end, ...rest } = clip;
    void _id; void _type; void _start; void _end;
    return rest as Partial<OverlayClip>;
  }
  return {};
}
