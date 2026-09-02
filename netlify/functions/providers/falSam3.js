// netlify/functions/providers/falSam3.js
//
// fal.ai SAM 3 Video provider for SmartVideo Timeline Studio.
//
// Production contract: fal-ai/sam-3/video
// Docs: https://fal.ai/models/fal-ai/sam-3/video/api
//
// This module runs server-side only. The FAL_KEY environment variable MUST
// never be exposed to the browser, Vite, or client JavaScript.

const FAL_BASE = 'https://queue.fal.run';
const FAL_MODEL = 'fal-ai/sam-3/video';

function getFalKey() {
  const key = process.env.FAL_KEY;
  if (!key) return null;
  return key;
}

async function falRequest(path, init = {}) {
  const key = getFalKey();
  if (!key) {
    const err = new Error('FAL_KEY is not configured');
    err.code = 'FAL_NOT_CONFIGURED';
    throw err;
  }
  const url = `${FAL_BASE}/${FAL_MODEL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      'Authorization': `Key ${key}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!response.ok) {
    const err = new Error(`fal ${path} failed: ${response.status} ${response.statusText}`);
    err.code = 'FAL_REQUEST_FAILED';
    err.status = response.status;
    err.body = body;
    throw err;
  }
  return body;
}

function normalizeResult(falResult) {
  if (!falResult || typeof falResult !== 'object') {
    const err = new Error('Invalid fal response shape');
    err.code = 'INVALID_SAM3_OUTPUT';
    throw err;
  }
  const video = falResult.video || {};
  const videoUrl = video.url || falResult.video_url;
  if (!videoUrl) {
    const err = new Error('fal response missing video.url');
    err.code = 'INVALID_SAM3_OUTPUT';
    throw err;
  }
  const boundingboxFramesZip = falResult.boundingbox_frames_zip || null;
  return {
    success: true,
    provider: 'fal',
    model: FAL_MODEL,
    requestId: falResult.request_id || falResult.requestId || null,
    video: {
      url: videoUrl,
      contentType: video.content_type || video.contentType || 'video/mp4',
      fileName: video.file_name || video.fileName || null,
      fileSize: video.file_size || video.fileSize || null,
    },
    boundingboxFramesZip: boundingboxFramesZip
      ? {
          url: boundingboxFramesZip.url,
          contentType: boundingboxFramesZip.content_type || 'application/zip',
          fileName: boundingboxFramesZip.file_name || null,
          fileSize: boundingboxFramesZip.file_size || null,
        }
      : null,
  };
}

function buildInput(params = {}) {
  const { video_url, prompt, pointPrompts, boxPrompts, applyMask, outputType, detectionThreshold } = params;
  if (!video_url) {
    const err = new Error('video_url is required');
    err.code = 'INVALID_VIDEO_URL';
    throw err;
  }
  const input = {
    video_url,
    apply_mask: applyMask !== false,
    video_output_type: outputType || 'X264 (.mp4)',
    detection_threshold: typeof detectionThreshold === 'number' ? detectionThreshold : 0.5,
  };
  if (prompt && typeof prompt === 'string' && prompt.trim()) {
    input.prompt = prompt.trim();
  }
  if (Array.isArray(pointPrompts) && pointPrompts.length > 0) {
    input.point_prompts = pointPrompts.map((p, i) => {
      if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') {
        const err = new Error(`Invalid point prompt at index ${i}`);
        err.code = 'INVALID_POINT_PROMPT';
        throw err;
      }
      return {
        x: Math.round(p.x),
        y: Math.round(p.y),
        label: p.label === 0 ? 0 : 1,
        object_id: typeof p.objectId === 'number' ? p.objectId : (typeof p.object_id === 'number' ? p.object_id : 1),
      };
    });
  }
  if (Array.isArray(boxPrompts) && boxPrompts.length > 0) {
    input.box_prompts = boxPrompts.map((b, i) => {
      if (!b || typeof b.xMin !== 'number' || typeof b.yMin !== 'number' || typeof b.xMax !== 'number' || typeof b.yMax !== 'number') {
        const err = new Error(`Invalid box prompt at index ${i}`);
        err.code = 'INVALID_BOX_PROMPT';
        throw err;
      }
      return {
        x_min: Math.round(b.xMin),
        y_min: Math.round(b.yMin),
        x_max: Math.round(b.xMax),
        y_max: Math.round(b.yMax),
        object_id: typeof b.objectId === 'number' ? b.objectId : (typeof b.object_id === 'number' ? b.object_id : 1),
      };
    });
  }
  return input;
}

export async function segmentVideoWithSAM3(params = {}) {
  try {
    const input = buildInput(params);
    const submit = await falRequest('', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const requestId = submit.request_id;
    if (!requestId) {
      return normalizeResult(submit);
    }
    // Poll for completion. fal returns {status: "IN_QUEUE"|"IN_PROGRESS"|"COMPLETED"}.
    const maxAttempts = 60;
    const baseInterval = 2000;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(r => setTimeout(r, baseInterval * Math.min(attempt, 10)));
      const status = await falRequest(`/requests/${requestId}/status`);
      const s = (status.status || '').toUpperCase();
      if (s === 'COMPLETED' || s === 'SUCCESS') {
        const result = await falRequest(`/requests/${requestId}`);
        return normalizeResult(result);
      }
      if (s === 'FAILED' || s === 'ERROR') {
        const err = new Error(`fal SAM3 failed: ${status.error || 'unknown'}`);
        err.code = 'FAL_REQUEST_FAILED';
        throw err;
      }
    }
    const err = new Error('fal SAM3 timed out');
    err.code = 'FAL_TIMEOUT';
    throw err;
  } catch (e) {
    if (e && e.code) {
      return { success: false, code: e.code, message: e.message, tool: 'sam3_segment' };
    }
    return { success: false, code: 'FAL_REQUEST_FAILED', message: e?.message || 'Unknown error', tool: 'sam3_segment' };
  }
}

// RLE mask provider for editable mask data persistence.
export async function segmentVideoToRLE(params = {}) {
  try {
    const input = buildInput(params);
    const submit = await falRequest('', {
      method: 'POST',
      body: JSON.stringify({ ...input, output: 'rle' }),
    });
    const requestId = submit.request_id;
    if (!requestId) {
      return normalizeResult(submit);
    }
    for (let attempt = 1; attempt <= 60; attempt++) {
      await new Promise(r => setTimeout(r, 2000 * Math.min(attempt, 10)));
      const status = await falRequest(`/requests/${requestId}/status`);
      const s = (status.status || '').toUpperCase();
      if (s === 'COMPLETED' || s === 'SUCCESS') {
        const result = await falRequest(`/requests/${requestId}`);
        return normalizeResult(result);
      }
      if (s === 'FAILED' || s === 'ERROR') {
        const err = new Error(`fal SAM3 RLE failed: ${status.error || 'unknown'}`);
        err.code = 'FAL_REQUEST_FAILED';
        throw err;
      }
    }
    const err = new Error('fal SAM3 RLE timed out');
    err.code = 'FAL_TIMEOUT';
    throw err;
  } catch (e) {
    if (e && e.code) {
      return { success: false, code: e.code, message: e.message, tool: 'sam3_segment_rle' };
    }
    return { success: false, code: 'FAL_REQUEST_FAILED', message: e?.message || 'Unknown error', tool: 'sam3_segment_rle' };
  }
}
