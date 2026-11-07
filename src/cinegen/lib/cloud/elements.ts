// [remix] Browser replacement for CineGen's lib/cloud/elements.ts (Firebase/Electron media persistence).
// Elements keep their image URLs as-is; the Timeline Editor stores media through editor.storeBlob.
import type { Element } from '@cinegen/types/elements';

export async function prepareElementReferences(element: Element, _projectId: string): Promise<Element> {
  return structuredClone(element);
}
