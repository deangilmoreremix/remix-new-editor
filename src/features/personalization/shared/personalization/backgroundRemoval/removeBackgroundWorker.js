/**
 * Module worker that runs BG0 (@bg0/browser: BiRefNet, WebGPU with a WASM
 * fallback) off the main thread. WASM inference blocks for ~10 s per image,
 * which would freeze the whole page.
 *
 * Plain JS on purpose: like the other workers in this repo it must load
 * as-is in the dev server and in production.
 *
 * BG0 is written for a page: it calls `document.createElement('canvas')` and
 * `localStorage`. A worker has neither, so before BG0 is imported this file
 * provides the two with OffscreenCanvas and an in-memory store. BG0's own
 * code runs unmodified.
 *
 * in:  { type: 'remove', id, blob, quality: 'fast' | 'quality' } | { type: 'cancel', id }
 * out: { type: 'progress', id, stage, progress, message }
 *      | { type: 'done', id, blob, width, height, provider, quality, durationMs }
 *      | { type: 'error', id, code, message }
 */

/** OffscreenCanvas with the one DOM-canvas method BG0 calls that it lacks. */
class WorkerCanvas extends OffscreenCanvas {
  constructor() {
    super(1, 1)
  }
  toBlob(callback, type, quality) {
    this.convertToBlob({ type: type || 'image/png', quality }).then(callback, () => callback(null))
  }
}

function installDomShims() {
  if (typeof self.document === 'undefined') {
    // Only canvas creation is real. ONNX Runtime also sniffs `document` (to find
    // its own script) when it exists, so the lookups it uses answer "nothing".
    self.document = {
      createElement(tag) {
        if (tag !== 'canvas') throw new Error(`document.createElement('${tag}') is not available in a worker`)
        return new WorkerCanvas()
      },
      currentScript: null,
      baseURI: self.location.href,
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementsByTagName: () => [],
    }
  }
  if (typeof self.localStorage === 'undefined') {
    const store = new Map()
    self.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => void store.set(key, String(value)),
      removeItem: (key) => void store.delete(key),
    }
  }
}

const controllers = new Map()

self.onmessage = async ({ data }) => {
  if (data?.type === 'cancel') {
    controllers.get(data.id)?.abort()
    return
  }
  if (data?.type !== 'remove') return
  const { id, blob, quality } = data
  const controller = new AbortController()
  controllers.set(id, controller)
  try {
    installDomShims()
    const { removeBackground } = await import('@bg0/browser')
    const result = await removeBackground(blob, {
      quality,
      signal: controller.signal,
      onProgress: ({ stage, progress, message }) => self.postMessage({ type: 'progress', id, stage, progress, message }),
    })
    self.postMessage({
      type: 'done',
      id,
      blob: result.blob,
      width: result.width,
      height: result.height,
      provider: result.provider,
      quality: result.quality,
      durationMs: result.durationMs,
    })
  } catch (error) {
    // BG0 wraps the real cause (e.g. a blocked script); keep it visible for diagnosis.
    console.warn('[bg0-worker]', error?.message, error?.cause ?? '')
    self.postMessage({ type: 'error', id, code: error?.code || 'unknown', message: error?.message || 'Background removal failed' })
  } finally {
    controllers.delete(id)
  }
}
