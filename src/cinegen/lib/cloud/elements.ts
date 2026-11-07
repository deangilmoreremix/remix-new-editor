// [remix] Browser replacement for CineGen's lib/cloud/elements.ts (Firebase/Electron media persistence).
// Elements keep their image URLs as-is; the Timeline Editor stores media through editor.storeBlob.
import type { Element } from '@cinegen/types/elements';

export async function prepareElementReferences(element: Element, _projectId: string): Promise<Element> {
  return structuredClone(element);
}

/** [remix] CineGen's prepareAudioReference without cloud persistence: keeps the source URL. */
export async function prepareAudioReference(source: string, _projectId: string, _assetId: string): Promise<string> {
  return source;
}
