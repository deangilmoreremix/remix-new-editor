import type { Asset } from '@cinegen/types/project';
import type { ShapeShotResult } from './shape-shot';
import { resolveMediaFileUrl, getLocalPathForFile } from '@cinegen/lib/utils/media-file';
import { generateId, timestamp } from '@cinegen/lib/utils/ids';

/** Keep the slot order and finish every upload before changing a draft or graph. */
export async function prepareShotAssets(result: ShapeShotResult): Promise<Asset[]> {
  const assets: Asset[] = [];
  for (const file of result.files) {
    const url = await resolveMediaFileUrl(file);
    const localPath = getLocalPathForFile(file);
    assets.push({ id: generateId(), name: file.name, type: 'image', url, fileSize: file.size,
      createdAt: timestamp(), ...(localPath ? { fileRef: localPath } : {}),
      metadata: { generatedVia: 'set-shot', setId: result.setId } });
  }
  return assets;
}
