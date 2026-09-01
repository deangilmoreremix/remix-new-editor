// Video Agent Studio — generation adapter contract.
//
// Phase 10 + 11 + 12. The OpenChatCut-derived studio asks for a
// capability (e.g. "video.generate", "audio.tts"); the SmartVideo
// generation adapter resolves the capability into a concrete model +
// provider, then runs the job through the existing SmartVideo
// generation infrastructure (MuAPI / model registry). The result
// becomes a SmartVideo asset which the studio inserts onto the
// timeline via the project's asset pool.
//
// The adapter is user-scoped. It NEVER accepts a provider key from
// the browser, and it NEVER trusts a browser-supplied userId.

/**
 * @typedef {Object} SmartVideoGenerationRequest
 * @property {string} capability
 *   One of:
 *     video.generate | image.generate | audio.tts | audio.music |
 *     audio.sfx | video.lipsync | video.upscale | video.reframe |
 *     video.transcribe | video.analyze | stock.video.search |
 *     stock.image.search
 * @property {Record<string, unknown>} inputs
 *   Capability-specific. Resolved against the model's input_schema.
 * @property {object} [target]
 * @property {string} [target.projectId]
 * @property {string} [target.timelineId]
 * @property {string} [target.trackId]
 * @property {number} [target.startFrame]
 * @property {string} [preferredModelId]
 * @property {string} [preferredProvider]
 */

/**
 * @typedef {Object} SmartVideoGenerationEstimate
 * @property {number} creditsEstimated
 * @property {string} currency          - 'credits' for now
 * @property {string} resolvedModelId
 * @property {string} resolvedProvider
 * @property {string[]} [alternatives]  - alternative model ids the user
 *   could pick
 * @property {string} [reason]          - why this model was chosen
 */

/**
 * @typedef {Object} SmartVideoGenerationJob
 * @property {string} jobId
 * @property {string} userId
 * @property {string} projectId
 * @property {'queued'|'running'|'waiting_provider'|'completed'|'failed'|'cancelled'} status
 * @property {number} progress          - 0..1
 * @property {string} resolvedModelId
 * @property {string} resolvedProvider
 * @property {string} [providerTaskId]
 * @property {string} [outputAssetId]   - set when status === 'completed'
 * @property {string} [outputUrl]
 * @property {string} [error]
 * @property {string} createdAt
 * @property {string} updatedAt
 */

export const SUPPORTED_CAPABILITIES = Object.freeze([
  'video.generate',
  'image.generate',
  'audio.tts',
  'audio.music',
  'audio.sfx',
  'video.lipsync',
  'video.upscale',
  'video.reframe',
  'video.transcribe',
  'video.analyze',
  'stock.video.search',
  'stock.image.search',
]);

/**
 * @param {string} capability
 * @returns {boolean}
 */
export function isSupportedCapability(capability) {
  return SUPPORTED_CAPABILITIES.includes(capability);
}

/**
 * @typedef {import('./types.js').SmartVideoGenerationAdapter}
 */

/**
 * In-memory implementation, used by tests. The production
 * implementation resolves models via `backend/services/modelCatalogService.js`
 * and dispatches via the existing `agentActionsService` MuAPI path.
 */
export class InMemorySmartVideoGenerationAdapter {
  constructor() {
    /** @type {Map<string, SmartVideoGenerationJob>} */
    this.jobs = new Map();
    this.estimateFor = (capability) => ({
      creditsEstimated: 1,
      currency: 'credits',
      resolvedModelId: `mock-${capability}`,
      resolvedProvider: 'mock',
      alternatives: [],
      reason: 'in-memory mock adapter',
    });
  }

  /**
   * @param {string} userId
   * @param {SmartVideoGenerationRequest} request
   * @returns {Promise<SmartVideoGenerationEstimate>}
   */
  async estimate(userId, request) {
    if (!isSupportedCapability(request.capability)) {
      throw new Error(`unsupported capability: ${request.capability}`);
    }
    return this.estimateFor(request.capability);
  }

  /**
   * @param {string} userId
   * @param {SmartVideoGenerationRequest} request
   * @param {{creditsReserved: number}} reservation
   * @returns {Promise<SmartVideoGenerationJob>}
   */
  async submit(userId, request, reservation) {
    if (!isSupportedCapability(request.capability)) {
      throw new Error(`unsupported capability: ${request.capability}`);
    }
    if (!reservation?.creditsReserved || reservation.creditsReserved < 0) {
      throw new Error('reservation missing');
    }
    const now = new Date().toISOString();
    const job = {
      jobId: crypto.randomUUID(),
      userId,
      projectId: request.target?.projectId || 'unscoped',
      status: 'queued',
      progress: 0,
      resolvedModelId: `mock-${request.capability}`,
      resolvedProvider: 'mock',
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.jobId, job);
    return job;
  }

  /**
   * @param {string} userId
   * @param {string} jobId
   * @returns {Promise<SmartVideoGenerationJob|null>}
   */
  async getJob(userId, jobId) {
    const j = this.jobs.get(jobId);
    if (!j || j.userId !== userId) return null;
    return j;
  }

  /**
   * @param {string} userId
   * @param {string} jobId
   * @returns {Promise<void>}
   */
  async cancel(userId, jobId) {
    const j = this.jobs.get(jobId);
    if (!j || j.userId !== userId) return;
    j.status = 'cancelled';
    j.updatedAt = new Date().toISOString();
  }
}
