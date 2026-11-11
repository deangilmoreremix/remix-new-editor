/**
 * remix-new-editor: save a file to remix's permanent Asset Library
 * (src/lib/assetLibrary.js → `public.media` + the user's storage folder), the
 * library the Library page lists. The ported personalization uploads go to
 * the `personalization-assets` bucket instead, which that page never reads.
 *
 * The owner is the verified Clerk user (assetLibrary resolves it), so no
 * MuAPI key is needed.
 */
export async function saveToRemixAssetLibrary(
  file: File,
  meta: { projectId?: string; source?: string } = {},
): Promise<{ id: string; url: string }> {
  const { saveAsset } = await import('../../../lib/assetLibrary.js')
  const asset = await saveAsset(file, {}, { source: 'personalization', ...meta })
  return { id: asset.id, url: asset.url }
}
