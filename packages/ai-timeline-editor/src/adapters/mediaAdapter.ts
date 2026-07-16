// mediaAdapter — maps upstream `@/domains/media-management` to this repo's media
// layer. The repo already has `lib/media` + Supabase media; here we expose a
// minimal contract the ported timeline uses (resolve a media id to a URL /
// metadata) without depending on the upstream Rust media service.

import type { Clip } from '../types/timeline';

export interface MediaDescriptor {
  id: string;
  url: string;
  kind: Clip['kind'];
  duration: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
}

export interface MediaAdapter {
  resolve(mediaId: string): Promise<MediaDescriptor | null>;
  /** Generate a thumbnail strip URL for an existing media id. */
  thumbnailFor(mediaId: string): string | undefined;
}

// Default in-memory registry. Consumers (or lib/media) register descriptors on
// mount so clips can resolve to real assets.
const registry = new Map<string, MediaDescriptor>();

export const mediaAdapter: MediaAdapter = {
  async resolve(mediaId) {
    return registry.get(mediaId) ?? null;
  },
  thumbnailFor(mediaId) {
    return registry.get(mediaId)?.thumbnailUrl;
  },
};

export function registerMedia(descriptor: MediaDescriptor): void {
  registry.set(descriptor.id, descriptor);
}

export function registerMany(descriptors: MediaDescriptor[]): void {
  descriptors.forEach((d) => registry.set(d.id, d));
}
