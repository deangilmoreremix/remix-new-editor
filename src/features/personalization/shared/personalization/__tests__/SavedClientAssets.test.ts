/**
 * Saved Clients & Assets Library tests
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  loadClients,
  createClient,
  saveClient,
  deleteClient,
  getCurrentClientId,
  setCurrentClientId,
} from '@ohb/shared/personalization/clientProfile'
import {
  loadClientAssets,
  saveClientAssets,
  deleteClientAssets,
  addAssetToClientLibrary,
  removeAssetFromClientLibrary,
  setPrimaryInClientLibrary,
  EMPTY_CLIENT_ASSET_LIBRARY,
} from '@ohb/shared/personalization/clientAssets'
import type { PersonalizationAsset } from '@ohb/shared/personalization/types'

const MOCK_STORAGE: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: (key: string) => MOCK_STORAGE[key] || null,
  setItem: (key: string, value: string) => { MOCK_STORAGE[key] = value },
  removeItem: (key: string) => { delete MOCK_STORAGE[key] },
  clear: () => { Object.keys(MOCK_STORAGE).forEach(k => delete MOCK_STORAGE[k]) },
  length: 0,
  key: () => null,
})

function makeAsset(overrides: Partial<PersonalizationAsset> = {}): PersonalizationAsset {
  return {
    id: `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role: 'presenter_identity',
    name: 'test.jpg',
    url: 'https://example.com/test.jpg',
    uploadedUrl: 'https://example.com/test.jpg',
    isPrimary: false,
    mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(),
    uploadStatus: 'ready',
    uploadError: null,
    file: null,
    ...overrides,
  }
}

describe('Saved Clients & Assets Library', () => {
  beforeEach(() => {
    localStorage.clear()
    MOCK_STORAGE['smartvideo_clients'] = '{}'
    MOCK_STORAGE['smartvideo_current_client_id'] = ''
    MOCK_STORAGE['smartvideo_client_assets'] = '{}'
  })

  describe('Client CRUD', () => {
    it('creates a client', () => {
      const client = createClient({ name: 'Test User', businessName: 'Test Co', audience: 'customer' })
      expect(client.id).toBeTruthy()
      expect(client.businessName).toBe('Test Co')
      expect(client.audience).toBe('customer')
    })

    it('saves and loads client', () => {
      const created = createClient({ name: 'Test User', businessName: 'Test Co', audience: 'customer' })
      saveClient(created)
      const loaded = loadClients()
      expect(loaded).toHaveLength(1)
      expect(loaded[0].id).toBe(created.id)
    })

    it('updates client fields', () => {
      const created = createClient({ name: 'Test User', businessName: 'Test Co', audience: 'customer' })
      saveClient({ ...created, businessName: 'Updated Co' })
      const loaded = loadClients()
      expect(loaded[0].businessName).toBe('Updated Co')
    })

    it('deletes client', () => {
      const created = createClient({ name: 'Test User', businessName: 'Test Co', audience: 'customer' })
      saveClient(created)
      deleteClient(created.id)
      const loaded = loadClients()
      expect(loaded).toHaveLength(0)
    })

    it('tracks current client id', () => {
      const created = createClient({ name: 'Test User', businessName: 'Test Co', audience: 'customer' })
      setCurrentClientId(created.id)
      expect(getCurrentClientId()).toBe(created.id)
    })
  })

  describe('Client Asset Persistence', () => {
    it('starts with empty library for unknown client', () => {
      const lib = loadClientAssets('unknown-client')
      expect(lib.identities).toHaveLength(0)
      expect(lib.logos).toHaveLength(0)
      expect(lib.products).toHaveLength(0)
      expect(lib.brandReferences).toHaveLength(0)
    })

    it('persists assets per client', () => {
      const client = createClient({ name: 'Test', businessName: 'Test Co', audience: 'customer' })
      saveClient(client)
      setCurrentClientId(client.id)

      const identity = makeAsset({ role: 'presenter_identity', name: 'dean.jpg' })
      const logo = makeAsset({ role: 'logo', name: 'logo.png' })
      const product = makeAsset({ role: 'product_reference', name: 'product.jpg' })
      const brand = makeAsset({ role: 'brand_reference', name: 'truck.jpg' })

      addAssetToClientLibrary(client.id, identity)
      addAssetToClientLibrary(client.id, logo)
      addAssetToClientLibrary(client.id, product)
      addAssetToClientLibrary(client.id, brand)

      const lib = loadClientAssets(client.id)
      expect(lib.identities).toHaveLength(1)
      expect(lib.logos).toHaveLength(1)
      expect(lib.products).toHaveLength(1)
      expect(lib.brandReferences).toHaveLength(1)
    })

    it('survives reload via localStorage', () => {
      const client = createClient({ name: 'Test', businessName: 'Test Co', audience: 'customer' })
      saveClient(client)

      const identity = makeAsset({ role: 'presenter_identity', name: 'dean.jpg' })
      addAssetToClientLibrary(client.id, identity)

      // Simulate reload by clearing in-memory state
      const reloaded = loadClientAssets(client.id)
      expect(reloaded.identities).toHaveLength(1)
      expect(reloaded.identities[0].name).toBe('dean.jpg')
    })

    it('supports primary identity', () => {
      const client = createClient({ name: 'Test', businessName: 'Test Co', audience: 'customer' })
      saveClient(client)

      const a1 = makeAsset({ role: 'presenter_identity', name: 'a1.jpg' })
      const a2 = makeAsset({ role: 'presenter_identity', name: 'a2.jpg' })
      addAssetToClientLibrary(client.id, a1)
      addAssetToClientLibrary(client.id, a2)

      setPrimaryInClientLibrary(client.id, 'identity', a2.id)
      const lib = loadClientAssets(client.id)
      expect(lib.primaryIdentity?.id).toBe(a2.id)
      expect(lib.identities.find(i => i.id === a2.id)?.isPrimary).toBe(true)
    })

    it('supports primary logo', () => {
      const client = createClient({ name: 'Test', businessName: 'Test Co', audience: 'customer' })
      saveClient(client)

      const logo = makeAsset({ role: 'logo', name: 'logo.png' })
      addAssetToClientLibrary(client.id, logo)
      setPrimaryInClientLibrary(client.id, 'logo', logo.id)

      const lib = loadClientAssets(client.id)
      expect(lib.primaryLogo?.id).toBe(logo.id)
    })

    it('removes asset from library', () => {
      const client = createClient({ name: 'Test', businessName: 'Test Co', audience: 'customer' })
      saveClient(client)

      const asset = makeAsset({ role: 'logo', name: 'logo.png' })
      addAssetToClientLibrary(client.id, asset)
      expect(loadClientAssets(client.id).logos).toHaveLength(1)

      removeAssetFromClientLibrary(client.id, asset.id)
      expect(loadClientAssets(client.id).logos).toHaveLength(0)
    })

    it('clears primary when primary asset is removed', () => {
      const client = createClient({ name: 'Test', businessName: 'Test Co', audience: 'customer' })
      saveClient(client)

      const asset = makeAsset({ role: 'logo', name: 'logo.png' })
      addAssetToClientLibrary(client.id, asset)
      setPrimaryInClientLibrary(client.id, 'logo', asset.id)
      expect(loadClientAssets(client.id).primaryLogo?.id).toBe(asset.id)

      removeAssetFromClientLibrary(client.id, asset.id)
      expect(loadClientAssets(client.id).primaryLogo).toBeNull()
    })

    it('deletes all assets when client is deleted', () => {
      const client = createClient({ name: 'Test', businessName: 'Test Co', audience: 'customer' })
      saveClient(client)

      const asset = makeAsset({ role: 'logo', name: 'logo.png' })
      addAssetToClientLibrary(client.id, asset)

      deleteClient(client.id)
      deleteClientAssets(client.id)
      const lib = loadClientAssets(client.id)
      expect(lib.logos).toHaveLength(0)
    })
  })

  describe('Client Isolation', () => {
    it('client A does not receive client B assets', () => {
      const clientA = createClient({ name: 'A', businessName: 'A Co', audience: 'customer' })
      const clientB = createClient({ name: 'B', businessName: 'B Co', audience: 'customer' })
      saveClient(clientA)
      saveClient(clientB)

      const assetA = makeAsset({ role: 'logo', name: 'logoA.png' })
      const assetB = makeAsset({ role: 'logo', name: 'logoB.png' })
      addAssetToClientLibrary(clientA.id, assetA)
      addAssetToClientLibrary(clientB.id, assetB)

      const libA = loadClientAssets(clientA.id)
      const libB = loadClientAssets(clientB.id)
      expect(libA.logos).toHaveLength(1)
      expect(libA.logos[0].name).toBe('logoA.png')
      expect(libB.logos).toHaveLength(1)
      expect(libB.logos[0].name).toBe('logoB.png')
    })
  })

  describe('Backwards Compatibility', () => {
    it('handles missing storage gracefully', () => {
      MOCK_STORAGE['smartvideo_client_assets'] = '{}'
      const lib = loadClientAssets('any-client')
      expect(lib.identities).toHaveLength(0)
    })

    it('handles corrupt storage gracefully', () => {
      MOCK_STORAGE['smartvideo_client_assets'] = 'not-json'
      const lib = loadClientAssets('any-client')
      expect(lib.identities).toHaveLength(0)
    })
  })

  describe('Discovery → Saved Client Integration', () => {
    it('persists imported assets to saved client library', () => {
      const client = createClient({ name: 'Test', businessName: 'Test Co', audience: 'customer' })
      saveClient(client)
      setCurrentClientId(client.id)

      // Simulate a discovered asset being imported into the active library
      const discoveredLogo = makeAsset({ role: 'logo', name: 'discovered-logo.png' })
      addAssetToClientLibrary(client.id, discoveredLogo)

      const lib = loadClientAssets(client.id)
      expect(lib.logos).toHaveLength(1)
      expect(lib.logos[0].name).toBe('discovered-logo.png')
    })

    it('survives client switch without leaking assets between clients', () => {
      const clientA = createClient({ name: 'A', businessName: 'A Co', audience: 'customer' })
      const clientB = createClient({ name: 'B', businessName: 'B Co', audience: 'customer' })
      saveClient(clientA)
      saveClient(clientB)

      const logoA = makeAsset({ role: 'logo', name: 'logoA.png' })
      addAssetToClientLibrary(clientA.id, logoA)

      // Switch to client B
      setCurrentClientId(clientB.id)
      const libB = loadClientAssets(clientB.id)
      expect(libB.logos).toHaveLength(0)

      // Switch back to client A
      setCurrentClientId(clientA.id)
      const libA = loadClientAssets(clientA.id)
      expect(libA.logos).toHaveLength(1)
      expect(libA.logos[0].name).toBe('logoA.png')
    })
  })
})
