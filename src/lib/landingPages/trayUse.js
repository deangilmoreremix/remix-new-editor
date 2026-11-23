// Use one tray item in a field: already stored items are used as they are; a studio result's temporary link is saved to the
// user's storage first, so the page never holds a link that will stop working. Returns the permanent https link.
import { isPermanentUrl } from './sourceRegistry.js';
import { ensurePermanent } from './ingest.js';
import { uploadMedia } from './mediaUpload.js';

export async function useTrayItem(item, { upload = uploadMedia, fetchImpl } = {}) {
  if (!item?.url) throw new Error('Nothing to use.');
  if (isPermanentUrl(item.url)) return item.url;
  const url = await ensurePermanent(item, { upload, fetchImpl });
  item.origUrl = item.origUrl || item.url;       // the temporary link may already be placed on the page: keep it so save can replace it
  item.url = url; item.permanent = true;           // later placements of the same item reuse the stored copy
  return url;
}
