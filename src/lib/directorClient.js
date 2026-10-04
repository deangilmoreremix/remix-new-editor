/**
 * Director (VideoDB) client for Render Studio finishing operations.
 *
 * Transport:
 *  - Video ingest uses the HTTP blueprint  POST /videodb/collection/<id>/video
 *  - Deterministic Render agent execution uses HTTP POST /api/render/agent/:agentName
 *  - Interactive Director chat still uses Socket.IO `/chat` namespace.
 *
 * Fail-loud contract: every function either returns a real result or throws.
 */

import { io } from 'socket.io-client';

const DIRECTOR_BASE = '/director-api'; // Vite proxy -> Director backend (localhost:8000 / Render)
const DIRECTOR_SOCKET_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DIRECTOR_SOCKET_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.VITE_DIRECTOR_SOCKET_URL) ||
  `${DIRECTOR_BASE}/chat`;
const DEFAULT_COLLECTION_ID = 'default';
const AGENT_TIMEOUT_MS = 180000; // 3 min

function resolveCollectionId(collectionId) {
  return collectionId || DEFAULT_COLLECTION_ID;
}

function assertString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be a JSON object`);
  }
}

/**
 * Normalize a raw Director agent response into the Render contract.
 */
export function normalizeDirectorResult(raw, agent) {
  if (!raw || typeof raw !== 'object') {
    return {
      status: 'error',
      agent,
      sessionId: null,
      conversationId: null,
      collectionId: null,
      videoId: null,
      videoUrl: null,
      scenes: [],
      highlights: [],
      subtitles: null,
      data: {},
      error: 'Empty or invalid Director response',
    };
  }

  const data = raw.data || {};
  const streamUrl = raw.videoUrl || data.stream_url || data.videoUrl || data.url || null;

  return {
    status: raw.status === 'error' ? 'error' : 'success',
    agent: raw.agent || agent,
    sessionId: raw.sessionId || raw.session_id || null,
    conversationId: raw.conversationId || raw.conv_id || null,
    collectionId: raw.collectionId || raw.collection_id || null,
    videoId: raw.videoId || raw.video_id || null,
    videoUrl: streamUrl,
    scenes: Array.isArray(data.scenes) ? data.scenes : [],
    highlights: Array.isArray(data.highlights) ? data.highlights : [],
    subtitles: data.subtitles ?? data.transcript ?? null,
    data: data || {},
    error: raw.error || null,
  };
}

async function postJson(path, body, { signal } = {}) {
  let res;
  try {
    res = await fetch(`${DIRECTOR_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    throw new Error(`Director request to ${path} failed: ${err.message}`);
  }
  if (!res.ok) {
    let detail = '';
    try {
      const txt = await res.text();
      detail = txt.slice(0, 200);
    } catch { /* ignore */ }
    throw new Error(`Director ${path} returned ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
}

async function getJson(path, { signal } = {}) {
  let res;
  try {
    res = await fetch(`${DIRECTOR_BASE}${path}`, { method: 'GET', signal });
  } catch (err) {
    throw new Error(`Director request to ${path} failed: ${err.message}`);
  }
  if (!res.ok) {
    throw new Error(`Director ${path} returned ${res.status}`);
  }
  return res.json();
}

/**
 * Upload a source video (by URL) into a Director/VideoDB collection.
 * @returns {Promise<{collectionId:string, videoId:string}>}
 */
export async function uploadVideoToDirector(videoUrl, { collectionId, name, signal } = {}) {
  const cid = resolveCollectionId(collectionId);
  const data = await postJson(
    `/videodb/collection/${encodeURIComponent(cid)}/video`,
    { source: videoUrl, source_type: 'url', name: name || 'render-studio-source' },
    { signal }
  );
  const videoId = data?.data?.id || data?.id;
  if (!videoId) {
    throw new Error('Director did not return a video_id after upload');
  }
  return { collectionId: cid, videoId: String(videoId) };
}

/**
 * Execute a named Director agent via the direct HTTP Render API.
 *
 * This is the preferred path for deterministic Render Studio actions because it:
 *  - skips the LLM reasoning layer,
 *  - returns a normalized JSON contract,
 *  - does not require Socket.IO.
 *
 * @param {object} opts
 * @param {string} opts.agent            Director agent name (e.g. 'subtitle')
 * @param {string} opts.videoId          VideoDB video id (from uploadVideoToDirector)
 * @param {string} [opts.collectionId]
 * @param {object} [opts.params]         Extra agent parameters
 * @returns {Promise<object>} normalized result
 */
export async function executeDirectAgent({
  agent,
  videoId,
  collectionId,
  params = {},
  signal,
} = {}) {
  assertString(agent, 'agent');
  assertString(videoId, 'videoId');
  const cid = resolveCollectionId(collectionId);
  assertObject(params, 'params');

  const body = {
    session_id: params.session_id || '',
    conv_id: params.conv_id || '',
    collection_id: cid,
    video_id: videoId,
    params: { ...params },
  };

  const raw = await postJson(`/render/agent/${encodeURIComponent(agent)}`, body, { signal });
  return normalizeDirectorResult(raw, agent);
}

/**
 * Invoke a named Director agent against an uploaded video over Socket.IO.
 * Kept for interactive Director chat; deterministic Render actions should
 * prefer executeDirectAgent().
 *
 * @param {object} opts
 * @param {string} opts.agent            Director agent name (e.g. 'subtitle')
 * @param {string} opts.videoId          VideoDB video id (from uploadVideoToDirector)
 * @param {string} [opts.collectionId]
 * @param {string} [opts.message]        Free-text instruction for the agent
 * @param {object} [opts.params]         Extra agent parameters
 * @returns {Promise<object>} normalized result
 */
export function invokeDirectorAgent({
  agent,
  videoId,
  collectionId,
  message,
  params = {},
  signal,
} = {}) {
  if (!agent) throw new Error('invokeDirectorAgent requires an agent name');
  if (!videoId) throw new Error('invokeDirectorAgent requires a videoId (upload first)');

  const cid = resolveCollectionId(collectionId);
  const payload = {
    message: message || `Run the ${agent} agent on the uploaded video.`,
    agents: [agent],
    collection_id: cid,
    video_id: videoId,
    ...params,
  };

  return new Promise((resolve, reject) => {
    const socket = io(DIRECTOR_SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 15000,
    });

    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      try { socket.close(); } catch { /* ignore */ }
      fn(value);
    };

    const timer = setTimeout(() => {
      finish(reject, new Error(`Director agent "${agent}" timed out after ${AGENT_TIMEOUT_MS / 1000}s`));
    }, AGENT_TIMEOUT_MS);

    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        finish(reject, new Error('Director agent invocation aborted'));
      });
    }

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      finish(reject, new Error(`Director Socket.IO connection failed: ${err?.message || err}`));
    });

    socket.on('connect', () => {
      socket.emit('chat', payload);
    });

    socket.on('chat', (outputMessage) => {
      const normalized = normalizeDirectorResult(outputMessage, agent);
      if (normalized.status === 'error' || normalized.error) {
        clearTimeout(timer);
        finish(reject, new Error(normalized.error || `Director agent "${agent}" failed`));
        return;
      }

      if (normalized.videoUrl || normalized.status === 'success') {
        clearTimeout(timer);
        finish(resolve, normalized);
      }
    });

    socket.on('disconnect', () => {
      if (!settled) {
        clearTimeout(timer);
        finish(reject, new Error(`Director agent "${agent}" disconnected before completing`));
      }
    });
  });
}

/**
 * Convenience: upload a source URL then run an agent in one call.
 * Returns { collectionId, videoId, result }.
 */
export async function runDirectorFinishingOp(agent, videoUrl, opts = {}) {
  const { collectionId, videoId } = opts.videoId
    ? { collectionId: opts.collectionId, videoId: opts.videoId }
    : await uploadVideoToDirector(videoUrl, opts);
  const result = await executeDirectAgent({ agent, videoId, collectionId, params: opts.params || {} });
  return { collectionId, videoId, result };
}

/**
 * Health check — throws if the Director backend is unreachable.
 */
export async function checkDirectorHealth(signal) {
  return getJson('/config/check', { signal });
}

export const directorClient = {
  uploadVideoToDirector,
  executeDirectAgent,
  invokeDirectorAgent,
  runDirectorFinishingOp,
  checkDirectorHealth,
  normalizeDirectorResult,
};

export default directorClient;
