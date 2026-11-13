'use client'

/**
 * Auto-cutout queue for the Asset Finder.
 *
 * Watches the discovered assets and removes the background of every eligible
 * one, strictly one at a time, on the user's device (BG0). Results are written
 * back onto the asset the same way an AI edit is (`editedDataUrl`, `edited`,
 * `hasTransparency`), with the original kept in `originalPreviewUrl`, so the
 * existing Revert / import / "Use in video" paths carry cutouts unchanged.
 *
 * Manual requests ("Remove BG", "Remove Background From Selected", Retry) put
 * an asset in the `queued` state and run even when auto mode is off.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { DiscoveredAsset, DiscoveredAssetBgRemoval } from '../types'
import { loadImageBlob } from './loadImageBlob'
import { verifyAlphaChannel } from '../alphaVerification'
import {
  BACKGROUND_REMOVAL_MODEL_MB,
  BackgroundRemovalFailure,
  blobToDataUrl,
  isConstrainedDevice,
  isRemovableImageType,
  removeAssetBackground,
} from './backgroundRemovalClient'

const AUTO_KEY = 'smartvideo.bgRemoval.auto'
const CONSENT_KEY = 'smartvideo.bgRemoval.consent'

export type BackgroundRemovalConsent = 'unknown' | 'granted' | 'declined'

export interface AutoCutoutStats {
  total: number
  finished: number
  running: number
  queued: number
  failed: number
  active: boolean
}

export interface AutoCutoutControls {
  autoEnabled: boolean
  setAutoEnabled: (enabled: boolean) => void
  consent: BackgroundRemovalConsent
  grantConsent: () => void
  declineConsent: () => void
  /** The queue has work but is waiting for the user to accept the model download. */
  needsConsent: boolean
  /** The model could not load; reloading the page is required before retrying. */
  halted: boolean
  /** Auto mode is on, the model download is accepted and the model is usable: new assets will get cutouts. */
  willAutoCutOut: boolean
  /** This browser can run background removal at all (BG0 decodes with createImageBitmap). */
  supported: boolean
  stats: AutoCutoutStats
  modelMB: number
  /** Queue the given assets for removal (runs even with auto mode off). */
  requestRemoval: (ids: string[]) => void
  retry: (id: string) => void
  toggleOriginal: (id: string) => void
  /** Stop the running job and drop manual queue entries. */
  cancelAll: () => void
}

function readStored(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeStored(key: string, value: string) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for the session.
  }
}

/** Auto mode is eligible for this asset (never touched, not edited, still wanted). */
export function isAutoEligible(a: DiscoveredAsset): boolean {
  return (
    !a.rejected &&
    !a.bgOptOut &&
    !a.edited &&
    !a.editedDataUrl &&
    !a.hasTransparency &&
    (!a.bgRemoval || a.bgRemoval.status === 'idle') &&
    Boolean(a.previewUrl)
  )
}

/** An asset whose cutout is queued, running, or about to start (auto mode will pick it up). */
export function isCutoutPending(a: DiscoveredAsset): boolean {
  if (a.rejected || a.bgOptOut) return false
  const status = a.bgRemoval?.status
  if (status === 'queued' || status === 'running') return true
  return isAutoEligible(a)
}

/** Longest the automatic placement of found assets waits for their cutouts. */
export const AUTO_IMPORT_CUTOUT_WAIT_MS = 90_000

/**
 * Should automatic placement of the picked assets keep waiting for their
 * cutouts? True only while cutouts are expected (`willAutoCutOut`), some pick is
 * still pending, and the wait limit has not passed. Anything else places the
 * assets now, exactly as it did before background removal existed.
 */
export function shouldHoldAutoImport(
  pickIds: string[],
  discovered: DiscoveredAsset[],
  opts: { willAutoCutOut: boolean; waitedMs: number },
): boolean {
  if (!opts.willAutoCutOut || pickIds.length === 0 || opts.waitedMs >= AUTO_IMPORT_CUTOUT_WAIT_MS) return false
  const ids = new Set(pickIds)
  return discovered.some((a) => ids.has(a.id) && isCutoutPending(a))
}

function priority(a: DiscoveredAsset): number {
  return (a.recommended ? 1000 : 0) + (a.relevanceScore ?? 0) + (a.qualityScore ?? 0) / 100
}

/** The image's real type from its first bytes (servers often send octet-stream). */
async function withSniffedType(blob: Blob): Promise<Blob> {
  if (isRemovableImageType(blob.type)) return blob
  try {
    const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
    const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to))
    let type = ''
    if (head[0] === 0x89 && ascii(1, 4) === 'PNG') type = 'image/png'
    else if (head[0] === 0xff && head[1] === 0xd8) type = 'image/jpeg'
    else if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') type = 'image/webp'
    return type ? new Blob([blob], { type }) : blob
  } catch {
    return blob
  }
}

export function useAutoCutout(
  assets: DiscoveredAsset[],
  setAssets: Dispatch<SetStateAction<DiscoveredAsset[]>>,
  options: { paused?: boolean; disabled?: boolean } = {},
): AutoCutoutControls {
  const paused = Boolean(options.paused)
  const disabled = Boolean(options.disabled)
  const constrained = useMemo(() => isConstrainedDevice(), [])
  // BG0 decodes images with createImageBitmap; without it (old browsers, jsdom) nothing can run, so stay idle.
  // `disabled`: the caller cannot offer it here (e.g. signed-out visitors cannot reach the image download proxy).
  const supported = useMemo(() => !disabled && typeof createImageBitmap === 'function', [disabled])
  const [autoEnabled, setAutoEnabledState] = useState<boolean>(() => readStored(AUTO_KEY) !== '0')
  const [consent, setConsent] = useState<BackgroundRemovalConsent>(() => {
    const stored = readStored(CONSENT_KEY)
    if (stored === 'granted' || stored === 'declined') return stored
    // Phones / data-saver / cellular must opt in to a ~192 MB download.
    return constrained ? 'unknown' : 'granted'
  })
  const [halted, setHalted] = useState(false)
  const [tick, setTick] = useState(0)

  const busyRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const runningIdRef = useRef<string | null>(null)
  const runningManualRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const patch = useCallback(
    (id: string, update: (a: DiscoveredAsset) => DiscoveredAsset) => {
      setAssets((prev) => prev.map((a) => (a.id === id ? update(a) : a)))
    },
    [setAssets],
  )
  const setBg = useCallback(
    (id: string, bg: DiscoveredAssetBgRemoval) => patch(id, (a) => ({ ...a, bgRemoval: bg })),
    [patch],
  )

  // What the queue would run next, in priority order.
  const next = useMemo(() => {
    const manual = assets
      .filter((a) => !a.rejected && a.bgRemoval?.status === 'queued')
      .sort((x, y) => priority(y) - priority(x))[0]
    if (manual) return { asset: manual, manual: true }
    if (!autoEnabled || !supported) return null
    const auto = assets.filter(isAutoEligible).sort((x, y) => priority(y) - priority(x))[0]
    return auto ? { asset: auto, manual: false } : null
  }, [assets, autoEnabled, supported])

  const needsConsent = supported && consent !== 'granted' && next !== null

  const run = useCallback(
    async (asset: DiscoveredAsset, manual: boolean) => {
      const id = asset.id
      const baselineEdit = asset.editedDataUrl
      const controller = new AbortController()
      abortRef.current = controller
      runningIdRef.current = id
      runningManualRef.current = manual
      setBg(id, { status: 'running', progress: 0, manual })

      const finish = (bg: DiscoveredAssetBgRemoval) => {
        if (mountedRef.current) setBg(id, bg)
      }

      try {
        const source = manual && asset.editedDataUrl ? asset.editedDataUrl : asset.originalPreviewUrl || asset.previewUrl
        const raw = await loadImageBlob(source, { signal: controller.signal })
        if (controller.signal.aborted) throw new BackgroundRemovalFailure('cancelled', 'Cancelled')
        const blob = await withSniffedType(raw)
        if (!isRemovableImageType(blob.type)) {
          finish({ status: 'skipped', message: 'Unsupported' })
          return
        }

        // Already a real cutout? Leave it alone.
        if (blob.type !== 'image/jpeg') {
          const before = await verifyAlphaChannel(await blobToDataUrl(blob))
          if (before.hasTransparentPixels && before.transparentRatio > 0.02) {
            patch(id, (a) => ({ ...a, hasTransparency: true, bgRemoval: { status: 'skipped', message: 'Transparent' } }))
            return
          }
        }

        let lastReported = 0
        const result = await removeAssetBackground(blob, {
          signal: controller.signal,
          onProgress: ({ progress }) => {
            if (!mountedRef.current || progress - lastReported < 0.02) return
            lastReported = progress
            setBg(id, { status: 'running', progress, manual })
          },
        })
        const dataUrl = await blobToDataUrl(result.blob)
        const check = await verifyAlphaChannel(dataUrl)
        if (!check.hasTransparentPixels) {
          finish({ status: 'skipped', message: 'No background' })
          return
        }

        if (!mountedRef.current) return
        setAssets((prev) =>
          prev.map((a) => {
            if (a.id !== id) return a
            // The user changed this asset while we worked (edited, restored, removed): keep theirs.
            if (a.rejected || a.bgOptOut || a.editedDataUrl !== baselineEdit) {
              return { ...a, bgRemoval: { status: 'idle' } }
            }
            return {
              ...a,
              originalPreviewUrl: a.originalPreviewUrl || a.previewUrl,
              editedDataUrl: dataUrl,
              edited: true,
              hasTransparency: true,
              videoReady: true,
              showOriginal: false,
              editMetadata: {
                operation: 'remove_background',
                engine: 'bg0',
                provider: result.provider,
                quality: result.quality,
                durationMs: result.durationMs,
              },
              bgRemoval: { status: 'done' },
            }
          }),
        )
      } catch (error) {
        const failure = controller.signal.aborted
          ? new BackgroundRemovalFailure('cancelled', 'Cancelled')
          : error instanceof BackgroundRemovalFailure
            ? error
            : new BackgroundRemovalFailure('unknown', error instanceof Error ? error.message : 'Background removal failed.')
        if (failure.code === 'cancelled') {
          finish({ status: 'idle' })
        } else {
          if (failure.needsReload && mountedRef.current) setHalted(true)
          finish({ status: 'error', message: failure.message })
        }
      } finally {
        abortRef.current = null
        runningIdRef.current = null
        busyRef.current = false
        if (mountedRef.current) setTick((n) => n + 1)
      }
    },
    [patch, setAssets, setBg],
  )

  // Drive the queue: one job at a time, whenever there is work and consent.
  useEffect(() => {
    if (busyRef.current || paused || halted || consent !== 'granted' || !next) return
    busyRef.current = true
    void run(next.asset, next.manual)
  }, [next, consent, halted, paused, run, tick])

  // Abort a running job whose asset was removed, restored or edited by the user.
  useEffect(() => {
    const id = runningIdRef.current
    if (!id) return
    const current = assets.find((a) => a.id === id)
    if (!current || current.rejected || current.bgOptOut) abortRef.current?.abort()
  }, [assets])

  // Turning auto mode off stops an automatic (non-manual) job in flight.
  useEffect(() => {
    if (!autoEnabled && runningIdRef.current && !runningManualRef.current) abortRef.current?.abort()
  }, [autoEnabled])

  const setAutoEnabled = useCallback((enabled: boolean) => {
    setAutoEnabledState(enabled)
    writeStored(AUTO_KEY, enabled ? '1' : '0')
  }, [])

  const grantConsent = useCallback(() => {
    setConsent('granted')
    writeStored(CONSENT_KEY, 'granted')
  }, [])

  const declineConsent = useCallback(() => {
    setConsent('declined')
    writeStored(CONSENT_KEY, 'declined')
    // Nothing downloads: manual requests go back to idle and auto mode switches off.
    setAutoEnabledState(false)
    writeStored(AUTO_KEY, '0')
    setAssets((prev) => prev.map((a) => (a.bgRemoval?.status === 'queued' ? { ...a, bgRemoval: { status: 'idle' } } : a)))
  }, [setAssets])

  const requestRemoval = useCallback(
    (ids: string[]) => {
      const wanted = new Set(ids)
      if (consent === 'declined') setConsent('unknown') // ask again: the user clearly wants it now
      setHalted(false)
      setAssets((prev) =>
        prev.map((a) =>
          wanted.has(a.id) && !a.rejected && a.bgRemoval?.status !== 'running' && a.bgRemoval?.status !== 'queued'
            ? { ...a, bgOptOut: false, bgRemoval: { status: 'queued', manual: true } }
            : a,
        ),
      )
    },
    [consent, setAssets],
  )

  const retry = useCallback((id: string) => requestRemoval([id]), [requestRemoval])

  const toggleOriginal = useCallback(
    (id: string) => patch(id, (a) => ({ ...a, showOriginal: !a.showOriginal })),
    [patch],
  )

  const cancelAll = useCallback(() => {
    abortRef.current?.abort()
    // Cancel must actually stop: every asset still waiting (or running) opts out of
    // automatic processing, otherwise idle + auto-eligible would restart the queue at once.
    // A manual "Remove BG" / Retry on an asset clears its opt-out again.
    setAssets((prev) =>
      prev.map((a) =>
        !a.rejected && (a.bgRemoval?.status === 'queued' || a.bgRemoval?.status === 'running' || isAutoEligible(a))
          ? { ...a, bgOptOut: true, bgRemoval: { status: 'idle' } }
          : a,
      ),
    )
  }, [setAssets])

  const stats = useMemo<AutoCutoutStats>(() => {
    let finished = 0
    let running = 0
    let queued = 0
    let failed = 0
    for (const a of assets) {
      if (a.rejected) continue
      const s = a.bgRemoval?.status
      if (s === 'done' || s === 'skipped') finished++
      else if (s === 'running') running++
      else if (s === 'queued') queued++
      else if (s === 'error') failed++
      else if (autoEnabled && supported && consent !== 'declined' && !halted && isAutoEligible(a)) queued++
    }
    const total = finished + running + queued + failed
    return { total, finished: finished + failed, running, queued, failed, active: running + queued > 0 }
  }, [assets, autoEnabled, supported, consent, halted])

  return {
    autoEnabled,
    setAutoEnabled,
    consent,
    grantConsent,
    declineConsent,
    needsConsent,
    halted,
    willAutoCutOut: supported && autoEnabled && consent === 'granted' && !halted,
    supported,
    stats,
    modelMB: BACKGROUND_REMOVAL_MODEL_MB,
    requestRemoval,
    retry,
    toggleOriginal,
    cancelAll,
  }
}
