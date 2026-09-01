// Video Agent Studio — structured event types.
//
// Phase 21. Long-running Video Agent Studio operations emit a stream
// of structured events. The transport in production is SSE (see
// backend/routes/video-agent-studio/events.js) backed by an in-memory
// pub/sub for tests. Avoid high-frequency polling when this transport
// is wired up.

export const VIDEO_AGENT_EVENT_TYPES = Object.freeze({
  AGENT_TURN_STARTED: 'agent.turn.started',
  AGENT_TOOL_STARTED: 'agent.tool.started',
  AGENT_TOOL_COMPLETED: 'agent.tool.completed',
  GENERATION_QUEUED: 'generation.queued',
  GENERATION_PROGRESS: 'generation.progress',
  GENERATION_COMPLETED: 'generation.completed',
  ASSET_CREATED: 'asset.created',
  PROPOSAL_CREATED: 'proposal.created',
  PROPOSAL_APPROVED: 'proposal.approved',
  PROPOSAL_REJECTED: 'proposal.rejected',
  TIMELINE_CHANGED: 'timeline.changed',
  EXPORT_STARTED: 'export.started',
  EXPORT_PROGRESS: 'export.progress',
  EXPORT_COMPLETED: 'export.completed',
  ERROR: 'error',
});

/**
 * @typedef {Object} VideoAgentEvent
 * @property {string} id
 * @property {string} type
 * @property {string} userId
 * @property {string} [projectId]
 * @property {string} [jobId]
 * @property {string} createdAt
 * @property {object} [data]
 */

/**
 * In-memory event bus. Production should back this with the existing
 * SmartVideo realtime channel (or an SSE endpoint).
 */
export class InMemoryVideoAgentEventBus {
  constructor() {
    /** @type {Map<string, Set<(e: VideoAgentEvent) => void>>} */
    this.subscribers = new Map();
  }

  /**
   * @param {string} userId
   * @param {(e: VideoAgentEvent) => void} handler
   * @returns {() => void} unsubscribe
   */
  subscribe(userId, handler) {
    if (!this.subscribers.has(userId)) this.subscribers.set(userId, new Set());
    this.subscribers.get(userId).add(handler);
    return () => {
      const set = this.subscribers.get(userId);
      if (set) set.delete(handler);
    };
  }

  /**
   * @param {VideoAgentEvent} event
   */
  publish(event) {
    const set = this.subscribers.get(event.userId);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(event);
      } catch (err) {
        // Don't let one bad subscriber take down the bus.
        // eslint-disable-next-line no-console
        console.error('[video-agent-event-bus] subscriber error', err);
      }
    }
  }
}
