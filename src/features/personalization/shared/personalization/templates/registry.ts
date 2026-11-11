/**
 * The shared Remotion design registry.
 *
 * Concrete designs live in `./catalog.ts` (owned by the catalog module) and
 * register themselves through `registerRemotionDesignTemplate(s)`. This module
 * never imports the catalog — the catalog imports the registry — so there is
 * no require cycle between the two.
 *
 * The registry is a plain module-level store. It also exposes a tiny
 * subscription so a React surface can re-render when a catalog registers
 * after the first paint.
 */

import { PREVIEW_ASPECT_RATIOS } from '../preview/types'
import type { PreviewAspectRatio } from '../preview/types'
import type {
  RemotionDesignCategory,
  RemotionDesignSupportCheck,
  RemotionDesignTemplate,
} from './types'

/** Registered templates, in registration order. */
const templates = new Map<string, RemotionDesignTemplate>()

/** Listeners notified whenever the registry contents change. */
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener()
    } catch {
      // A broken subscriber must never break registration.
    }
  }
}

/**
 * Registers one design template.
 *
 * Throws on a duplicate id: two designs sharing an id would make the
 * persisted `remotionDesignId` ambiguous, so the mistake must fail loudly at
 * import time rather than silently pick a winner.
 */
export function registerRemotionDesignTemplate(template: RemotionDesignTemplate): void {
  if (!template || typeof template !== 'object') {
    throw new Error('registerRemotionDesignTemplate: a template object is required')
  }
  const id = typeof template.id === 'string' ? template.id.trim() : ''
  if (!id) {
    throw new Error('registerRemotionDesignTemplate: a template needs a non-empty id')
  }
  if (templates.has(id)) {
    throw new Error(`registerRemotionDesignTemplate: duplicate design template id "${id}"`)
  }
  templates.set(id, template)
  notify()
}

/**
 * Registers a list of design templates.
 *
 * Atomic: when one entry is invalid or duplicated nothing is registered at
 * all, so a half-loaded catalog can never be observed.
 */
export function registerRemotionDesignTemplates(list: RemotionDesignTemplate[]): void {
  if (!Array.isArray(list) || list.length === 0) return
  const seen = new Set<string>()
  for (const template of list) {
    if (!template || typeof template !== 'object') {
      throw new Error('registerRemotionDesignTemplates: every entry must be a template object')
    }
    const id = typeof template.id === 'string' ? template.id.trim() : ''
    if (!id) {
      throw new Error('registerRemotionDesignTemplates: every template needs a non-empty id')
    }
    if (seen.has(id) || templates.has(id)) {
      throw new Error(`registerRemotionDesignTemplates: duplicate design template id "${id}"`)
    }
    seen.add(id)
  }
  for (const template of list) {
    templates.set(template.id.trim(), template)
  }
  notify()
}

/** Looks a design up by id. Returns `undefined` when it is not registered. */
export function getRemotionDesignTemplate(id: string): RemotionDesignTemplate | undefined {
  if (typeof id !== 'string') return undefined
  return templates.get(id)
}

/** Every registered design, in registration order. */
export function listRemotionDesignTemplates(): RemotionDesignTemplate[] {
  return Array.from(templates.values())
}

/** The registered designs of one category, in registration order. */
export function listRemotionDesignTemplatesByCategory(
  category: RemotionDesignCategory,
): RemotionDesignTemplate[] {
  return listRemotionDesignTemplates().filter((template) => template.category === category)
}

/**
 * Whether a design can be used in the given context.
 *
 * Checks, in order: the design exists, it can be exported in the browser, it
 * supports the requested aspect ratio, and it is preview compatible.
 */
export function isRemotionDesignTemplateSupported(
  id: string,
  aspectRatio: PreviewAspectRatio,
): RemotionDesignSupportCheck {
  const template = getRemotionDesignTemplate(id)
  if (!template) {
    return { supported: false, reason: `Unknown design "${id}".` }
  }
  if (!template.capabilities || !template.capabilities.browserExport) {
    return {
      supported: false,
      reason:
        template.capabilities?.notes ||
        `Design "${template.name}" cannot be exported in the browser.`,
    }
  }
  const aspectRatios =
    Array.isArray(template.aspectRatios) && template.aspectRatios.length > 0
      ? template.aspectRatios
      : PREVIEW_ASPECT_RATIOS
  if (!aspectRatios.includes(aspectRatio)) {
    return {
      supported: false,
      reason: `Design "${template.name}" does not support the ${aspectRatio} format.`,
    }
  }
  if (template.previewCompatible === false) {
    return {
      supported: false,
      reason:
        template.previewCompatibleReason ||
        `Design "${template.name}" cannot be previewed.`,
    }
  }
  return { supported: true }
}

/**
 * Notifies a listener whenever the registry changes.
 *
 * Returns an unsubscribe function.
 */
export function subscribeRemotionDesignRegistry(listener: () => void): () => void {
  if (typeof listener !== 'function') return () => {}
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Empties the registry.
 *
 * Test-only helper: the catalog registers itself as an import side effect, so
 * a unit test that registers its own fixtures needs a way to start from an
 * empty registry.
 */
export function __resetRemotionDesignRegistry(): void {
  templates.clear()
  notify()
}
