/**
 * Playable URLs for processed presenter footage (Stage 3).
 *
 * A bake produces a Blob; its blob: URL only lives in this page. Settings never store it (a blob: URL does not
 * survive a reload and normalizePresenter refuses it). They store the matte's content `key`; this registry maps
 * a key to the URL that can be played right now, and is refilled from the local store on load
 * (guided/presenterMatteStore.ts). A durable https `url` on the settings is the fallback when nothing is registered.
 */
const urls = new Map<string, string>()
const listeners = new Set<() => void>()

export function registerMatteUrl(key: string, url: string): void {
  const previous = urls.get(key)
  if (previous && previous !== url && previous.startsWith('blob:')) {
    try { URL.revokeObjectURL(previous) } catch { /* not a revocable URL in this environment */ }
  }
  urls.set(key, url)
  listeners.forEach((l) => l())
}

export function unregisterMatteUrl(key: string): void {
  const previous = urls.get(key)
  if (previous?.startsWith('blob:')) {
    try { URL.revokeObjectURL(previous) } catch { /* ignore */ }
  }
  urls.delete(key)
  listeners.forEach((l) => l())
}

export function resolveMatteUrl(matte: { key: string; url?: string } | undefined): string | null {
  if (!matte) return null
  return urls.get(matte.key) ?? matte.url ?? null
}

export function subscribeMatteRegistry(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Test helper. */
export function clearMatteRegistry(): void {
  urls.clear()
  listeners.forEach((l) => l())
}
