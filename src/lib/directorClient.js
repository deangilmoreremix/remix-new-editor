/**
 * Director (VideoDB) client for Render Studio finishing operations.
 *
 * All finishing ops (subtitles, highlights, shorts, voiceover, dubbing, etc.)
 * are delegated to the Director backend, which orchestrates VideoDB. This keeps
 * the actual media work server-side and on VideoDB (per project decision), and
 * removes the MuAPI mock fallbacks that previously violated the "fail loudly"
 * rule (no silent/placeholder results).
 *
 * Transport:
 *  - Video ingest uses the HTTP blueprint  POST /videodb/collection/<id>/video
 *    (confirmed present in apps/director/backend director/entrypoint/api/routes.py).
 *  - Agent execution uses the Director Socket.IO `/chat` namespace (the official
 *    transport — Director exposes chat ONLY over Socket.IO). We emit a `chat`
 *    event with { message, agents:[name], collection_id, video_id } and listen
 *    for streamed `chat` events carrying the agent output (video stream_url /
 *    status). A best-effort HTTP POST to /chat is kept as a fallback, but the
 *    primary path is Socket.IO so execution is guaranteed when the backend is up.
 *
 * Fail-loud contract: every function either returns a real result (with a
 * `url`/`stream_url` from VideoDB, or structured metadata) or throws. There is
 * intentionally no `simulated` / mock fallback here.
 */

import { io } from 'socket.io-client';

const DIRECTOR_BASE = '/director-api'; // Vite proxy -> Director backend (localhost:8000 / Render)
const DEFAULT_COLLECTION_ID = 'default';
const AGENT_TIMEOUT_MS = 180000; // 3 min — VideoDB ops can be slow

function resolveCollectionId(collectionId) {
  return collectionId || DEFAULT_COLLECTION_ID;
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
 * Invoke a named Director agent against an uploaded video over Socket.IO.
 *
 * @param {object} opts
 * @param {string} opts.agent            Director agent name (e.g. 'subtitle')
 * @param {string} opts.videoId          VideoDB video id (from uploadVideoToDirector)
 * @param {string} [opts.collectionId]
 * @param {string} [opts.message]        Free-text instruction for the agent
 * @param {object} [opts.params]         Extra agent parameters (video_language, etc.)
 * @returns {Promise<object>} normalized result { status, url, data }
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
    const socket = io(DIRECTOR_BASE, {
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

    const extractUrl = (outputMessage) => {
      const contents = outputMessage?.content || [];
      for (const part of contents) {
        if (part?.agent_name === agent || !part?.agent_name) {
          const url = part?.video?.stream_url || part?.video?.url;
          if (url) return url;
        }
      }
      // Fallback: scan any video content.
      for (const part of contents) {
        if (part?.video?.stream_url || part?.video?.url) {
          return part.video.stream_url || part.video.url;
        }
      }
      return null;
    };

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      finish(reject, new Error(`Director Socket.IO connection failed: ${err?.message || err}`));
    });

    socket.on('connect', () => {
      socket.emit('chat', payload);
    });

    socket.on('chat', (outputMessage) => {
      const status = outputMessage?.status;
      const url = extractUrl(outputMessage);
      const agentError = (outputMessage?.content || []).find(
        (p) => p?.agent_name === agent && p?.status === 'error'
      );

      if (agentError) {
        clearTimeout(timer);
        finish(reject, new Error(agentError?.status_message || `Director agent "${agent}" failed`));
        return;
      }

      if (status === 'error') {
        clearTimeout(timer);
        finish(reject, new Error(outputMessage?.status_message || `Director agent "${agent}" failed`));
        return;
      }

      // Resolve as soon as the agent has produced a usable URL or reported success.
      if (url || status === 'success') {
        clearTimeout(timer);
        finish(resolve, {
          status: status || 'success',
          url,
          data: outputMessage,
          agent,
        });
      }
    });

    socket.on('disconnect', () => {
      if (!settled) {
        // Connection dropped without a terminal event — try the HTTP fallback.
        postJson('/chat', payload, { signal })
          .then((result) => {
            const rStatus = result?.status || result?.agent_response?.status;
            if (rStatus === 'error' || result?.success === false) {
              finish(reject, new Error(result?.message || `Director agent "${agent}" failed`));
            } else {
              const url =
                result?.data?.stream_url ||
                result?.video?.stream_url ||
                result?.data?.url ||
                result?.url;
              finish(resolve, { status: rStatus || 'success', url, data: result, agent });
            }
          })
          .catch((err) => {
            clearTimeout(timer);
            finish(reject, new Error(`Director disconnected and HTTP fallback failed: ${err.message}`));
          });
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
  const result = await invokeDirectorAgent({ agent, videoId, collectionId, ...opts });
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
  invokeDirectorAgent,
  runDirectorFinishingOp,
  checkDirectorHealth,
};

export default directorClient;
