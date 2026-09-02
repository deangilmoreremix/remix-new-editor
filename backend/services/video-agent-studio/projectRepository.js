// Video Agent Studio — project repository contract.
//
// The OpenChatCut-derived Video Agent Studio stores its projects as a
// ProjectDoc (see apps/video-agent-studio/src/persist/projectDoc.ts in
// the upstream). The SmartVideo SaaS persists that document as a single
// JSONB blob per project version, rather than prematurely normalising
// every clip/track into SQL.
//
// This module defines the contract that any storage backend (Supabase,
// Postgres, future R2-backed KV) must implement. It is intentionally
// small: the actual ProjectDoc is opaque to the storage layer so we
// can swap engines without re-mapping fields.
//
// All methods are user-scoped. The caller MUST pass a verified user id
// (see backend/middleware/auth.js); the implementation MUST reject
// cross-user access.

/**
 * @typedef {Object} VideoAgentProject
 * @property {string} id              - Project id (uuid).
 * @property {string} userId          - Owner user id.
 * @property {string} name            - User-visible name.
 * @property {object} projectDoc      - The OpenChatCut ProjectDoc (JSONB).
 * @property {number} revision        - Monotonic revision counter.
 * @property {string} createdAt       - ISO timestamp.
 * @property {string} updatedAt       - ISO timestamp.
 */

/**
 * @typedef {Object} VideoAgentProjectVersion
 * @property {string} id
 * @property {string} projectId
 * @property {number} revision
 * @property {object} projectDoc
 * @property {string} createdAt
 * @property {string|null} note
 */

/**
 * @typedef {Object} VideoAgentCreateProjectInput
 * @property {string} name
 * @property {object} [initialProjectDoc]
 */

/**
 * @typedef {Object} VideoAgentListProjectRow
 * @property {string} id
 * @property {string} name
 * @property {number} revision
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} [durationMs]
 * @property {string} [thumbnailUrl]
 */

/**
 * @typedef {Object} VideoAgentSaveProjectInput
 * @property {string} projectId
 * @property {object} projectDoc
 * @property {string} [note]
 */

/**
 * @typedef {import('./types.js').VideoAgentProjectRepository}
 */

export const VIDEO_AGENT_PROJECT_REPOSITORY_SYMBOL = Symbol.for(
  '@smartvideo/video-agent-studio/project-repository',
);

/**
 * In-memory implementation, useful for tests and for local development
 * before the Postgres-backed implementation is wired up. It is
 * intentionally trivial — it exists to make the contract testable,
 * not to be the production backend.
 */
export class InMemoryVideoAgentProjectRepository {
  constructor() {
    /** @type {Map<string, VideoAgentProject>} */
    this.projects = new Map();
    /** @type {Map<string, VideoAgentProjectVersion[]>} */
    this.versions = new Map();
    /** @type {Map<string, string>} */
    this.owners = new Map();
  }

  /**
   * @param {string} userId
   * @param {VideoAgentCreateProjectInput} input
   * @returns {Promise<VideoAgentProject>}
   */
  async createProject(userId, input) {
    if (!userId) throw new Error('userId is required');
    if (!input?.name) throw new Error('name is required');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const project = {
      id,
      userId,
      name: input.name,
      projectDoc: input.initialProjectDoc || {},
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(id, project);
    this.owners.set(id, userId);
    this.versions.set(id, [
      {
        id: crypto.randomUUID(),
        projectId: id,
        revision: 1,
        projectDoc: project.projectDoc,
        createdAt: now,
        note: input.note || 'initial',
      },
    ]);
    return project;
  }

  /**
   * @param {string} userId
   * @param {string} projectId
   * @returns {Promise<VideoAgentProject|null>}
   */
  async getProject(userId, projectId) {
    if (this.owners.get(projectId) !== userId) return null;
    return this.projects.get(projectId) || null;
  }

  /**
   * @param {string} userId
   * @param {{limit?:number, cursor?:string}} [opts]
   * @returns {Promise<{rows: VideoAgentListProjectRow[], nextCursor: string|null}>}
   */
  async listProjects(userId, opts = {}) {
    const limit = Math.min(opts.limit || 25, 100);
    const rows = [];
    for (const project of this.projects.values()) {
      if (project.userId !== userId) continue;
      rows.push({
        id: project.id,
        name: project.name,
        revision: project.revision,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      });
    }
    rows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return { rows: rows.slice(0, limit), nextCursor: null };
  }

  /**
   * @param {string} userId
   * @param {VideoAgentSaveProjectInput} input
   * @returns {Promise<VideoAgentProject>}
   */
  async saveProject(userId, input) {
    if (this.owners.get(input.projectId) !== userId) {
      throw new Error('project not found');
    }
    const current = this.projects.get(input.projectId);
    if (!current) throw new Error('project not found');
    const now = new Date().toISOString();
    const next = {
      ...current,
      projectDoc: input.projectDoc,
      revision: current.revision + 1,
      updatedAt: now,
    };
    this.projects.set(current.id, next);
    const versions = this.versions.get(current.id) || [];
    versions.push({
      id: crypto.randomUUID(),
      projectId: current.id,
      revision: next.revision,
      projectDoc: input.projectDoc,
      createdAt: now,
      note: input.note || null,
    });
    this.versions.set(current.id, versions);
    return next;
  }

  /**
   * @param {string} userId
   * @param {string} projectId
   * @param {{limit?:number}} [opts]
   * @returns {Promise<VideoAgentProjectVersion[]>}
   */
  async listVersions(userId, projectId, opts = {}) {
    if (this.owners.get(projectId) !== userId) return [];
    const versions = this.versions.get(projectId) || [];
    return versions.slice(-1 * (opts.limit || 50)).reverse();
  }

  /**
   * @param {string} userId
   * @param {string} projectId
   * @param {number} revision
   * @returns {Promise<VideoAgentProjectVersion|null>}
   */
  async getVersion(userId, projectId, revision) {
    if (this.owners.get(projectId) !== userId) return null;
    const versions = this.versions.get(projectId) || [];
    return versions.find((v) => v.revision === revision) || null;
  }

  /**
   * @param {string} userId
   * @param {string} projectId
   * @returns {Promise<void>}
   */
  async deleteProject(userId, projectId) {
    if (this.owners.get(projectId) !== userId) {
      throw new Error('project not found');
    }
    this.projects.delete(projectId);
    this.versions.delete(projectId);
    this.owners.delete(projectId);
  }
}
