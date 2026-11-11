/**
 * clientAssets.ts
 *
 * Saved client asset library persistence.
 *
 * Stores reusable personalization assets keyed by client ID so users can
 * pick up previous identities, logos, products, and brand references without
 * re-uploading or rediscovering them.
 */

import type { PersonalizationAsset } from './types'

const CLIENT_ASSETS_KEY = 'smartvideo_client_assets'

export interface ClientAssetLibrary {
  identities: PersonalizationAsset[]
  primaryIdentity: PersonalizationAsset | null
  logos: PersonalizationAsset[]
  primaryLogo: PersonalizationAsset | null
  products: PersonalizationAsset[]
  brandReferences: PersonalizationAsset[]
}

export const EMPTY_CLIENT_ASSET_LIBRARY: ClientAssetLibrary = {
  identities: [],
  primaryIdentity: null,
  logos: [],
  primaryLogo: null,
  products: [],
  brandReferences: [],
}

export interface SavedClientAssets {
  [clientId: string]: ClientAssetLibrary
}

function readStorage(): SavedClientAssets {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(CLIENT_ASSETS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStorage(data: SavedClientAssets) {
  if (typeof window === 'undefined') return
  localStorage.setItem(CLIENT_ASSETS_KEY, JSON.stringify(data))
}

export function loadClientAssets(clientId: string): ClientAssetLibrary {
  if (!clientId) return { ...EMPTY_CLIENT_ASSET_LIBRARY }
  const data = readStorage()
  const saved = data[clientId]
  if (!saved) return { ...EMPTY_CLIENT_ASSET_LIBRARY }
  return {
    identities: Array.isArray(saved.identities) ? saved.identities : [],
    primaryIdentity: saved.primaryIdentity || null,
    logos: Array.isArray(saved.logos) ? saved.logos : [],
    primaryLogo: saved.primaryLogo || null,
    products: Array.isArray(saved.products) ? saved.products : [],
    brandReferences: Array.isArray(saved.brandReferences) ? saved.brandReferences : [],
  }
}

export function saveClientAssets(clientId: string, library: ClientAssetLibrary) {
  if (!clientId) return
  const data = readStorage()
  data[clientId] = library
  writeStorage(data)
}

export function deleteClientAssets(clientId: string) {
  const data = readStorage()
  delete data[clientId]
  writeStorage(data)
}

export function addAssetToClientLibrary(
  clientId: string,
  asset: PersonalizationAsset,
): ClientAssetLibrary {
  const current = loadClientAssets(clientId)
  const next = { ...current }

  switch (asset.role) {
    case 'presenter_identity':
    case 'face_identity':
    case 'character_identity':
      next.identities = [...current.identities, asset]
      next.primaryIdentity = current.primaryIdentity || asset
      break
    case 'logo':
      next.logos = [...current.logos, asset]
      next.primaryLogo = current.primaryLogo || asset
      break
    case 'product_reference':
      next.products = [...current.products, asset]
      break
    case 'brand_reference':
      next.brandReferences = [...current.brandReferences, asset]
      break
    default:
      break
  }

  saveClientAssets(clientId, next)
  return next
}

export function removeAssetFromClientLibrary(clientId: string, assetId: string): ClientAssetLibrary {
  const current = loadClientAssets(clientId)
  const next = {
    identities: current.identities.filter((a) => a.id !== assetId),
    primaryIdentity: current.primaryIdentity?.id === assetId ? null : current.primaryIdentity,
    logos: current.logos.filter((a) => a.id !== assetId),
    primaryLogo: current.primaryLogo?.id === assetId ? null : current.primaryLogo,
    products: current.products.filter((a) => a.id !== assetId),
    brandReferences: current.brandReferences.filter((a) => a.id !== assetId),
  }
  saveClientAssets(clientId, next)
  return next
}

export function setPrimaryInClientLibrary(
  clientId: string,
  role: 'identity' | 'logo',
  assetId: string,
): ClientAssetLibrary {
  const current = loadClientAssets(clientId)
  const next = { ...current }

  if (role === 'identity') {
    next.identities = current.identities.map((a) => ({ ...a, isPrimary: a.id === assetId }))
    next.primaryIdentity = current.identities.find((a) => a.id === assetId) || current.primaryIdentity
  } else if (role === 'logo') {
    next.logos = current.logos.map((a) => ({ ...a, isPrimary: a.id === assetId }))
    next.primaryLogo = current.logos.find((a) => a.id === assetId) || current.primaryLogo
  }

  saveClientAssets(clientId, next)
  return next
}

export function updateAssetInClientLibrary(
  clientId: string,
  asset: PersonalizationAsset,
): ClientAssetLibrary {
  const current = loadClientAssets(clientId)
  const next = { ...current }

  const updateList = (list: PersonalizationAsset[]) =>
    list.map((a) => (a.id === asset.id ? asset : a))

  switch (asset.role) {
    case 'presenter_identity':
    case 'face_identity':
    case 'character_identity':
      next.identities = updateList(current.identities)
      if (current.primaryIdentity?.id === asset.id) {
        next.primaryIdentity = asset
      }
      break
    case 'logo':
      next.logos = updateList(current.logos)
      if (current.primaryLogo?.id === asset.id) {
        next.primaryLogo = asset
      }
      break
    case 'product_reference':
      next.products = updateList(current.products)
      break
    case 'brand_reference':
      next.brandReferences = updateList(current.brandReferences)
      break
    default:
      break
  }

  saveClientAssets(clientId, next)
  return next
}
