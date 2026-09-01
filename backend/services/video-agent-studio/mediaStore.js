// Video Agent Studio — media adapter contract.
//
// Phase 9. The OpenChatCut-derived studio assumes local-first media
// (file:// URLs, IndexedDB blobs). The SmartVideo SaaS replaces that
// with object storage (Supabase Storage / Cloudflare R2) using a
// stable asset identity and a per-user / per-project layout.
//
// Layout (canonical):
//   video-agent/{userId}/{projectId}/{assetId}/{filename}
//
// The adapter is intentionally narrow:
//
//   - It produces a signed/authenticated URL the iframe can use to
//     read or write the asset.
//   - It validates upload types and sizes server-side.
//   - It preserves source metadata so the editor can relink.
//
// It does NOT depend on the underlying storage SDK; the concrete
// implementation lives in `mediaStore.js` (Supabase + R2 hybrid).

/**
 * @typedef {Object} VideoAgentAssetMetadata
 * @property {string} id
 * @property {string} userId
 * @property {string} projectId
 * @property {string} filename
 * @property {string} mimeType
 * @property {number} byteSize
 * @property {string} [durationMs]
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} createdAt
 * @property {string} [sourceKind]   - 'upload' | 'generation' | 'stock'
 * @property {string} [sourceRef]    - e.g. provider task id
 */

export const ALLOWED_UPLOAD_MIME_PREFIXES = ['video/', 'audio/', 'image/'];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024; // 5 GiB

/**
 * @param {string} mime
 * @returns {boolean}
 */
export function isAllowedUploadMime(mime) {
  if (!mime || typeof mime !== 'string') return false;
  return ALLOWED_UPLOAD_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

/**
 * @typedef {import('./types.js').VideoAgentMediaStore}
 */

/**
 * In-memory implementation, used by tests. The production
 * implementation is provided by `mediaStore.js` and binds to the
 * existing SmartVideo `hybrid-supabase.js` + R2 helpers.
 */
export class InMemoryVideoAgentMediaStore {
  constructor() {
    /** @type {Map<string, VideoAgentAssetMetadata>} */
    this.assets = new Map();
  }

  /**
   * @param {string} userId
   * @param {string} projectId
   * @param {{filename:string, mimeType:string, byteSize:number, data:Uint8Array}} input
   * @returns {Promise<{asset: VideoAgentAssetMetadata, readUrl: string}>}
   */
  async putAsset(userId, projectId, input) {
    if (!isAllowedUploadMime(input.mimeType)) {
      throw new Error('mime type not allowed');
    }
    if (input.byteSize > MAX_UPLOAD_BYTES) {
      throw new Error('upload exceeds maximum size');
    }
    const id = crypto.randomUUID();
    const asset = {
      id,
      userId,
      projectId,
      filename: input.filename,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      createdAt: new Date().toISOString(),
      sourceKind: 'upload',
    };
    this.assets.set(id, asset);
    return { asset, readUrl: `memory://video-agent/${userId}/${projectId}/${id}/${input.filename}` };
  }

  /**
   * @param {string} userId
   * @param {string} projectId
   * @returns {Promise<VideoAgentAssetMetadata[]>}
   */
  async listAssets(userId, projectId) {
    const rows = [];
    for (const a of this.assets.values()) {
      if (a.userId === userId && a.projectId === projectId) rows.push(a);
    }
    rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return rows;
  }

  /**
   * @param {string} userId
   * @param {string} assetId
   * @returns {Promise<string|null>} a signed/authenticated URL or null
   * if the asset does not exist for this user.
   */
  async getReadUrl(userId, assetId) {
    const a = this.assets.get(assetId);
    if (!a || a.userId !== userId) return null;
    return `memory://video-agent/${a.userId}/${a.projectId}/${a.id}/${a.filename}`;
  }

  /**
   * @param {string} userId
   * @param {string} assetId
   * @returns {Promise<void>}
   */
  async deleteAsset(userId, assetId) {
    const a = this.assets.get(assetId);
    if (!a || a.userId !== userId) {
      throw new Error('asset not found');
    }
    this.assets.delete(assetId);
  }
}
