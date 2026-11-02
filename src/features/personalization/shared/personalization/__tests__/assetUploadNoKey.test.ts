/**
 * Saving an asset needs no MuAPI key: without one the original is stored
 * durably and the MuAPI copy is deferred to generation time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const adapter = vi.hoisted(() => ({
  persistMuAPIAssetOriginal: vi.fn(),
  uploadImageToMuAPI: vi.fn(),
  uploadVideoToMuAPI: vi.fn(),
}))

vi.mock('@ohb/lib/muapiUpload', () => ({
  ...adapter,
  resolveMuAPIMediaInput: vi.fn(),
  handleMuAPIUploadError: (error: unknown) => ({ class: 'unknown', message: error instanceof Error ? error.message : 'Upload failed' }),
}))
vi.mock('../../auth/stableUserId', () => ({ getStableUserId: () => 'workspace-1' }))

import { uploadPersonalizationAsset } from '../assetUploadService'

const file = new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' })

beforeEach(() => {
  vi.clearAllMocks()
  adapter.persistMuAPIAssetOriginal.mockResolvedValue({ durableRef: 'ws/logo.png', durableUrl: 'https://store.example/ws/logo.png' })
  adapter.uploadImageToMuAPI.mockResolvedValue({ url: 'https://muapi.example/tmp.png', uploadedAt: 0 })
})

describe('uploadPersonalizationAsset', () => {
  it('saves to durable storage without a MuAPI key and skips the MuAPI copy', async () => {
    const result = await uploadPersonalizationAsset('', { file, assetId: 'logo-1' })

    expect(result.url).toBe('https://store.example/ws/logo.png')
    expect(result.muapiUrl).toBeUndefined()
    expect(adapter.persistMuAPIAssetOriginal).toHaveBeenCalledTimes(1)
    expect(adapter.uploadImageToMuAPI).not.toHaveBeenCalled()
  })

  it('still makes the MuAPI copy when a key is present', async () => {
    const result = await uploadPersonalizationAsset('sk-key', { file, assetId: 'logo-1' })

    expect(result.url).toBe('https://store.example/ws/logo.png')
    expect(result.muapiUrl).toBe('https://muapi.example/tmp.png')
    expect(adapter.uploadImageToMuAPI).toHaveBeenCalledTimes(1)
  })
})
