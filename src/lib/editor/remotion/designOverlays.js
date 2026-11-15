// src/lib/editor/remotion/designOverlays.js
//
// Personalize-window designs (Remotion components) as timeline overlays. The
// design catalog is large, so it is loaded only when a project has a design
// overlay: call loadDesigns(designIdsInModel(model)) before rendering a model
// (the preview engine and the sandboxed export runner both do), after which
// getDesignOverlay() returns the component synchronously. Same pattern as
// effects.js.
let component = null;
let pending = null;

/** Design ids used by the overlays of a composition model. */
export const designIdsInModel = (model) => [...new Set((model?.layers || [])
  .filter((l) => l.kind === 'overlay' && l.type === 'overlay-design' && l.options?.designId)
  .map((l) => String(l.options.designId)))];

/** Load the design renderer (once) when any design is used. */
export function loadDesigns(ids = []) {
  if (!ids.length || component) return Promise.resolve();
  pending ||= import('../../../features/personalization/shared/personalization/preview/DesignOverlay')
    .then((m) => { component = m.DesignOverlay; })
    .catch(() => { pending = null; });
  return pending;
}

/** The loaded design renderer, or null until loadDesigns has resolved. */
export const getDesignOverlay = () => component;
