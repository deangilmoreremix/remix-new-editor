/**
 * The Supabase durable store must read back exactly what it wrote: `put()`
 * returns a ref that already carries the workspace folder, and `open()` must
 * not prefix it a second time (PR review finding on #44).
 */
import { describe, it, expect } from 'vitest'
import { createSupabaseDurableStore } from '../lib/muapiUpload'

function memoryStorage() {
  const objects = new Map<string, Blob>()
  const bucket = {
    async upload(path: string, body: Blob) { objects.set(path, body); return { error: null } },
    async download(path: string) {
      const data = objects.get(path) ?? null
      return { data, error: data ? null : { message: 'not found' } }
    },
    getPublicUrl(path: string) { return { data: { publicUrl: `https://cdn.example/${path}` } } },
  }
  return { objects, client: { from: () => bucket } }
}

describe('createSupabaseDurableStore', () => {
  const workspace = 'smartvideo-go:clerk:user_123'

  it('round-trips an original through put() and open()', async () => {
    const { client, objects } = memoryStorage()
    const store = createSupabaseDurableStore(client as any)
    const record = await store.put({ workspaceId: workspace, assetId: 'logo1', blob: new Blob(['png']), name: 'logo.png', type: 'image/png' })

    expect([...objects.keys()]).toEqual(['smartvideo-go-clerk-user_123/logo1/logo.png'])
    expect(record.durableRef).toBe('smartvideo-go-clerk-user_123/logo1/logo.png')

    const original = await store.open(workspace, record.durableRef)
    expect(original).not.toBeNull()
    expect(original?.name).toBe('logo.png')
  })

  it('still opens a bare <asset>/<name> ref inside the workspace', async () => {
    const { client } = memoryStorage()
    const store = createSupabaseDurableStore(client as any)
    await store.put({ workspaceId: workspace, assetId: 'logo1', blob: new Blob(['png']), name: 'logo.png', type: 'image/png' })
    expect(await store.open(workspace, 'logo1/logo.png')).not.toBeNull()
  })

  it("refuses refs into another workspace or that traverse upward", async () => {
    const { client } = memoryStorage()
    const store = createSupabaseDurableStore(client as any)
    await store.put({ workspaceId: 'smartvideo-go:clerk:other', assetId: 'a', blob: new Blob(['x']), name: 'x.png', type: 'image/png' })
    expect(await store.open(workspace, 'smartvideo-go-clerk-other/a/x.png')).toBeNull()
    expect(await store.open(workspace, '../smartvideo-go-clerk-other/a/x.png')).toBeNull()
  })
})
