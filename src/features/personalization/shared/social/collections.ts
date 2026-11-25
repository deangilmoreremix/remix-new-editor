import { newId, type KV } from './draftStore'

/** Prefix-namespaced saved items (caption templates, hashtag groups, content blocks, brand assets). */
export type CollectionName = 'caption-template' | 'hashtag-group' | 'content-block' | 'brand-asset'

export interface SavedItem { id: string; name: string; value: string; createdAt: number; meta?: Record<string, any> }

export class Collection {
  constructor(private kv: KV, private name: CollectionName) {}
  private key(id: string) { return `sp:${this.name}:${id}` }
  async list(): Promise<SavedItem[]> {
    const prefix = `sp:${this.name}:`
    const keys = (await this.kv.keys()).filter((k) => k.startsWith(prefix))
    const items = await Promise.all(keys.map((k) => this.kv.get<SavedItem>(k)))
    return items.filter((i): i is SavedItem => !!i).sort((a, b) => b.createdAt - a.createdAt)
  }
  async add(name: string, value: string, meta?: Record<string, any>): Promise<SavedItem> {
    const item: SavedItem = { id: newId(), name: name.trim() || 'Untitled', value, createdAt: Date.now(), meta }
    await this.kv.set(this.key(item.id), item)
    return item
  }
  async remove(id: string) { await this.kv.del(this.key(id)) }
}
