/**
 * In-browser stand-in for OpenHiggsBolt's `/api/v1/upload_file` Next.js route.
 *
 * OpenHiggsBolt's upload adapter (./muapiUpload.ts) posts to that route, which
 * re-issues the upload to MuAPI server-side and can re-upload a durable
 * original by asset id. remix has no such route; its uploads go through the
 * shared adapter in src/lib/muapiUpload.js (Supabase edge proxy for small
 * files, direct-to-MuAPI for large ones, with the key from Settings). This
 * module answers the three requests the OpenHiggsBolt adapter makes, using
 * remix's adapter for the MuAPI hop:
 *
 *   POST multipart {file, durable_asset_id?}   → upload bytes
 *   POST ?durable=resolve {durable_asset_id}    → re-upload the durable original
 *   GET  ?durable_asset_id=…                    → read the durable record
 *
 * Durable originals are written straight to Supabase Storage by the adapter;
 * the asset id → durable record index is kept in localStorage so a later
 * session can re-upload by asset id.
 */
import { uploadFileToMuapi } from '../../../lib/muapiUpload.js'
import { apiKeyManager } from '../../../lib/apiKeyManager.js'
import type { MuAPIDurableRecord, MuAPIDurableStore } from './muapiUpload'

export const VIRTUAL_UPLOAD_ROUTE = 'remix-personalization://upload_file'
const INDEX_KEY = 'remix_personalization_durable_assets'
const URL_LIFETIME_MS = 60 * 60 * 1000

type IndexEntry = Pick<MuAPIDurableRecord, 'workspaceId' | 'assetId' | 'durableRef' | 'durableUrl' | 'name' | 'type' | 'size'>

function readIndex(): Record<string, IndexEntry> {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function writeIndex(index: Record<string, IndexEntry>): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch {
    /* quota — the asset still works this session through the in-memory cache */
  }
}

let durableStoreRef: MuAPIDurableStore | null = null

/** Wrap a durable store so every put is indexed by asset id. */
export function indexDurableStore(store: MuAPIDurableStore): MuAPIDurableStore {
  durableStoreRef = store
  return {
    async put(input) {
      const record = await store.put(input)
      const index = readIndex()
      index[input.assetId] = {
        workspaceId: record.workspaceId,
        assetId: record.assetId,
        durableRef: record.durableRef,
        durableUrl: record.durableUrl,
        name: record.name,
        type: record.type,
        size: record.size,
      }
      writeIndex(index)
      return record
    },
    open: (workspaceId, durableRef) => store.open(workspaceId, durableRef),
  }
}

async function uploadBlob(blob: Blob, name: string, apiKey: string | null): Promise<Response> {
  const file = blob instanceof File ? blob : new File([blob], name || 'file', { type: blob.type || 'application/octet-stream' })
  const muapiKey = apiKey || apiKeyManager.getMuapiKey() || ''
  try {
    const result = (await uploadFileToMuapi(file, { userId: '', workspaceId: '', muapiKey })) as unknown
    const url = typeof result === 'string' ? result : (result as { url?: string })?.url
    if (!url) return Response.json({ error: 'No URL returned from upload' }, { status: 502 })
    const uploadedAt = Date.now()
    return Response.json({
      url,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt,
      expiresAt: uploadedAt + URL_LIFETIME_MS,
      source: 'bytes',
    })
  } catch (error) {
    const err = error as { status?: number; code?: string; message?: string }
    const status = err?.status || (err?.code === 'MUAPI_KEY_MISSING' ? 401 : 502)
    return new Response(err?.message || 'Upload failed', { status })
  }
}

export async function virtualUploadFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const method = (init?.method || 'GET').toUpperCase()
  const headers = new Headers(init?.headers)
  const apiKey = headers.get('x-api-key')

  if (method === 'GET') {
    const assetId = url.searchParams.get('durable_asset_id') || ''
    const entry = readIndex()[assetId]
    if (!entry) return new Response('Not found', { status: 404 })
    return Response.json(entry)
  }

  if (url.searchParams.get('durable') === 'resolve') {
    let assetId = ''
    try {
      assetId = JSON.parse(String(init?.body || '{}'))?.durable_asset_id || ''
    } catch {
      assetId = ''
    }
    const entry = readIndex()[assetId]
    if (!entry || !durableStoreRef) return new Response('Not found', { status: 404 })
    const original = await durableStoreRef.open(entry.workspaceId, entry.durableRef)
    if (!original) return new Response('Not found', { status: 404 })
    const response = await uploadBlob(original.blob, entry.name || original.name, apiKey)
    if (!response.ok) return response
    const payload = await response.json()
    return Response.json({ ...payload, source: 'durable', durableRef: entry.durableRef, durableUrl: entry.durableUrl })
  }

  const body = init?.body
  if (!(body instanceof FormData)) return new Response('Expected multipart form data', { status: 400 })
  const file = body.get('file')
  if (!(file instanceof Blob)) return new Response('file is required', { status: 400 })
  return uploadBlob(file, (file as File).name || 'file', apiKey)
}
