/**
 * "Get link" for a studio result.
 *
 *   const r = await getLink({ url, kind: 'video', title: 'AI video' });
 *   // -> { fileUrl, kind, reused, watchUrl, canonicalUrl, pageError }
 *
 * 1. Copies the result into OUR storage (copyToStorage) -> a permanent direct file URL. Images and audio stop here.
 * 2. Videos also get a page: a one-clip /watch/<id> published through the same code as the Timeline editor, plus the
 *    readable /v/<business>/<slug> address when a signed-in owner has a business name.
 *
 * Idempotent: the same person + same result gives the same file and the same /watch id, and clicks while one is
 * running share the running one. A remembered link is re-checked before it is reused (the file must still answer and
 * the page must still be published), so a deleted file or page is made again instead of handed out dead.
 * The file link is returned even when the page link fails (pageError says why).
 *
 * Who the link belongs to is decided ONCE, at the click, and used for the copy, the publish and the slug: if the
 * person signs in or out part-way, it stops with a message instead of publishing under the wrong owner.
 * Signed-out people all share the storage folder 'anonymous', so a per-browser salt is mixed into the names.
 */
import { preparePublishProject, publishVideo, getMyVideo, getMyBusiness, setVideoSlug, slugify, validateSlug, canonicalUrl, watchUrl } from '../editor/publish/publishClient.js';
import { copyToStorage } from './copyToStorage.js';
import { buildMinimalProject } from './minimalProject.js';
import { probeVideo } from './probeVideo.js';
import { createLinkCache } from './linkCache.js';
import { stableId, canonicalSource } from './ids.js';
import { verifyPublicFile } from './storageUpload.js';
import { getPublishOwnerClient, getOwnerKey, getGuestSalt, isSignedIn } from './ownerClient.js';

export class LinkError extends Error {
  constructor(code, message) { super(message); this.name = 'LinkError'; this.code = code; }
}

const inflight = new Map();
let sharedCache = null;
const defaultCache = () => (sharedCache ||= createLinkCache());

/** A person-readable message for a failed page publish. */
export function pageErrorMessage(err) {
  const text = String(err?.message || err || '');
  if (/guest_limit_videos/i.test(text)) return 'Guests can publish up to 10 videos. Sign in to publish more. Your file link still works.';
  if (/sign in/i.test(text) || /jwt|row-level|permission/i.test(text)) return 'Sign in to create a page link. Your file link still works.';
  return `The page link could not be created (${text.slice(0, 120) || 'unknown error'}). Your file link still works.`;
}

async function readableAddress({ client, id, title }) {
  const { business } = await getMyBusiness(client).catch(() => ({ business: null }));
  if (!business) return null;
  const base = slugify(title, 'video').slice(0, 40).replace(/-+$/g, '') || 'video';
  for (const suffix of [id.slice(-4), id.slice(-7)]) {
    const slug = `${base}-${suffix}`;
    if (validateSlug(slug)) continue;
    try { await setVideoSlug(client, id, slug); return canonicalUrl({ id, business, slug }); } catch (err) { if (!/taken/i.test(err?.message || '')) return null; }
  }
  return null;
}

/** True when the remembered file still exists. A failed check counts as "gone": the copy is simply made again. */
async function stillThere(url, verify) {
  try { return !!(await verify(url))?.exists; } catch { return false; }
}

/**
 * @param {object} o { url, kind, title, durationHint, deps } - deps are for tests:
 *   { ownerKey, guestSalt, copy, getClient, signedIn, probe, cache, verifyFile }
 */
export async function getLink({ url, kind = 'video', title = 'AI video', durationHint, deps = {} } = {}) {
  if (!url) throw new LinkError('no_url', 'There is no result to link yet.');
  const isIn = deps.signedIn ?? isSignedIn;
  const signedIn = !!isIn();
  const ownerKey = deps.ownerKey || await getOwnerKey();
  const scope = ownerKey === 'anonymous' ? `anonymous:${deps.guestSalt ?? getGuestSalt()}` : ownerKey;
  const source = canonicalSource(url);
  const key = stableId(`${scope}|${source}`);
  if (inflight.has(key)) return inflight.get(key);

  const run = async () => {
    const cache = deps.cache || defaultCache();
    const verify = deps.verifyFile || ((u) => verifyPublicFile(u));
    let cached = cache.get(key);
    let fileUrl = null;
    let finalKind = kind;
    let reused = false;
    if (cached?.fileUrl) {
      if (await stillThere(cached.fileUrl, verify)) { fileUrl = cached.fileUrl; finalKind = cached.kind || kind; reused = true; }
      else { cache.delete(key); cached = null; }
    }
    if (!fileUrl) {
      const copy = await (deps.copy || copyToStorage)(source, { kind, ownerKey, scope });
      fileUrl = copy.fileUrl;
      finalKind = copy.kind || kind;
      reused = !!copy.reused;
      cache.set(key, { fileUrl, kind: finalKind });
      if (!!isIn() !== signedIn) throw new LinkError('identity_changed', 'You signed in or out while the link was being made. Click Get link again.');
    }
    const result = { fileUrl, kind: finalKind, reused, watchUrl: null, canonicalUrl: null, pageError: null };
    if (finalKind !== 'video') return result;

    const id = `v${stableId(`${scope}|${source}|page`)}`;
    try {
      const client = await (deps.getClient || getPublishOwnerClient)({ signedIn });
      let canonical = cached?.canonical || null;
      let page = null;
      if (cached?.watchId) {
        const row = await getMyVideo(client, cached.watchId).catch(() => null);
        if (row?.published) page = cached.watchId;
      }
      if (!page) {
        const probe = durationHint ? { duration: durationHint } : await (deps.probe || probeVideo)(fileUrl);
        if (!probe?.duration) throw new Error('the video could not be read to build a page');
        const project = preparePublishProject(buildMinimalProject({ fileUrl, title, durationSec: probe.duration, width: probe.width, height: probe.height }), { title });
        await publishVideo(client, { id, project });
        page = id;
        canonical = null;
      }
      // A readable address is only remembered when it exists; a missing one is tried again next time.
      if (!canonical && signedIn) canonical = await readableAddress({ client, id: page, title });
      cache.set(key, { watchId: page, ...(canonical ? { canonical } : {}) });
      return { ...result, watchUrl: watchUrl(page), canonicalUrl: canonical };
    } catch (err) {
      return { ...result, pageError: pageErrorMessage(err) };
    }
  };

  const promise = run().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
