// withStudioRoutes.js
//
// Non-mutating wrapper that decorates each ACADEMY_ASSET with the studio
// route / model it should open in ("Try this in Studio"). The raw catalog
// (catalog.js, auto-generated) is left untouched — this is a pure projection.
//
// The decorated fields mirror the conventions used by examplesRail.js
// (normalizeItem's academy branch): `__route` and `__model`. We additionally
// expose the friendlier `studio` / `route` / `model` aliases for direct
// consumers (e.g. InteractiveTemplates.jsx).

import { ACADEMY_ASSETS } from './catalog.js';
import { getAcademyStudioRoute } from './studioRoutes.ts';

const DEFAULT_ROUTE = 'image';

/**
 * Return a new array of assets, each annotated with studio routing info.
 * @param {Array} [assets] source assets (defaults to ACADEMY_ASSETS)
 */
export function withAcademyStudioRoutes(assets = ACADEMY_ASSETS) {
  return assets.map((asset) => {
    const target = getAcademyStudioRoute(asset.category);
    const route = target?.route || DEFAULT_ROUTE;
    const model = target?.model || null;
    return {
      ...asset,
      __route: route,
      __model: model,
      studio: target?.studio || null,
      route,
      model,
    };
  });
}

export const ACADEMY_ASSETS_WITH_ROUTES = withAcademyStudioRoutes();

export { getAcademyStudioRoute };
