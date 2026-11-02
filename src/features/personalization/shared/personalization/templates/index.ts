/**
 * Public entry point of the shared Remotion design registry.
 *
 * The composition imports THIS module (never the registry and the catalog
 * separately) so there is exactly one place that knows about both:
 *
 *   PersonalizationComposition ──▶ templates/index ──▶ templates/catalog
 *                                    │                        │
 *                                    └──▶ templates/registry ◀──┘
 *
 * The registry never imports the catalog, so the two cannot form a require
 * cycle. The catalog registers itself as an import side effect, and the
 * import is STATIC so the designs are registered before the first preview
 * frame — the web renderer renders this very same composition, so a design
 * that registered late would be missing from the export.
 */

export * from './types'
export * from './registry'

// The concrete design catalog registers itself on import.
import './catalog'
