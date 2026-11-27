'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DraftStore, defaultKV, type KV } from '@ohb/shared/social/draftStore'
import { Collection, type CollectionName } from '@ohb/shared/social/collections'
import { detectCapabilities, type Capabilities } from '@ohb/shared/social/capabilities'

export interface Stores { kv: KV; persistent: boolean; drafts: DraftStore; collection: (n: CollectionName) => Collection }

/** One lazily-opened local store (IndexedDB, memory fallback) for the whole studio. */
export function useStores(): Stores | null {
  const [s, setS] = useState<Stores | null>(null)
  useEffect(() => {
    let alive = true
    void defaultKV().then((kv) => alive && setS({ kv, persistent: kv.persistent, drafts: new DraftStore(kv), collection: (n) => new Collection(kv, n) }))
    return () => { alive = false }
  }, [])
  return s
}

export function useCapabilities(): Capabilities { return useMemo(() => detectCapabilities(), []) }

export function useOnline(): boolean {
  const [on, setOn] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return on
}

export interface MediaMeta { width?: number; height?: number; duration?: number }

/** Reads dimensions/duration from the asset without keeping a decoded frame around. */
export function useMediaMeta(url: string | undefined, type: 'video' | 'image'): MediaMeta {
  const [meta, setMeta] = useState<MediaMeta>({})
  useEffect(() => {
    setMeta({})
    if (!url) return
    let cancelled = false
    if (type === 'image') {
      const img = new Image()
      img.onload = () => !cancelled && setMeta({ width: img.naturalWidth, height: img.naturalHeight })
      img.src = url
      return () => { cancelled = true; img.onload = null; img.src = '' }
    }
    const v = document.createElement('video')
    v.preload = 'metadata'; v.muted = true
    v.onloadedmetadata = () => !cancelled && setMeta({ width: v.videoWidth, height: v.videoHeight, duration: v.duration })
    v.src = url
    return () => { cancelled = true; v.onloadedmetadata = null; v.removeAttribute('src'); v.load() }
  }, [url, type])
  return meta
}

/** Revoke every object URL we created when the component unmounts. */
export function useObjectUrls() {
  const urls = useRef(new Set<string>())
  useEffect(() => () => { urls.current.forEach((u) => URL.revokeObjectURL(u)); urls.current.clear() }, [])
  return {
    create: (b: Blob) => { const u = URL.createObjectURL(b); urls.current.add(u); return u },
    revoke: (u: string) => { if (urls.current.delete(u)) URL.revokeObjectURL(u) },
  }
}

export const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b) })

export const btn = 'px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed'
export const btnPrimary = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#d9ff00] text-black hover:bg-[#d9ff00]/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed'
export const field = 'w-full rounded-lg bg-black/30 border border-white/10 px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#d9ff00]/50'
export const h4 = 'text-[11px] font-bold uppercase tracking-wide text-white/40 mb-2'
