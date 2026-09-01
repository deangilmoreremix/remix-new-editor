// tests/unit/fal-sam3-provider.test.js
//
// Validates the fal-ai/sam-3/video provider adapter contract.
// - Text mode builds correct payload
// - Point mode maps point prompts with label/object_id
// - Box mode maps box prompts with object_id
// - Output normalization produces { success, provider, model, video, ... }
// - Missing FAL_KEY returns FAL_NOT_CONFIGURED
// - Invalid output (no video.url) returns INVALID_SAM3_OUTPUT
// - Provider failure does not produce a successful result

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Force the FAL_KEY to a dummy value so the module doesn't bail at import.
process.env.FAL_KEY = 'test-fal-key';

// Mock the global fetch used by the provider.
function mockFetchSequence(responses) {
  let i = 0;
  global.fetch = vi.fn(async () => {
    const r = responses[i++] || responses[responses.length - 1];
    return {
      ok: r.ok !== false,
      status: r.status || 200,
      statusText: r.statusText || 'OK',
      text: async () => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
    };
  });
}

const { segmentVideoWithSAM3, segmentVideoToRLE } = await import('../../netlify/functions/providers/falSam3.js');

describe('fal-ai/sam-3/video provider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns FAL_NOT_CONFIGURED when FAL_KEY is missing', async () => {
    const prev = process.env.FAL_KEY;
    delete process.env.FAL_KEY;
    // Force a fresh import to re-evaluate getFalKey. The module-level getFalKey
    // captures process.env at call time, so deleting it is sufficient.
    const result = await segmentVideoWithSAM3({ video_url: 'https://example.com/v.mp4' });
    expect(result.success).toBe(false);
    expect(result.code).toBe('FAL_NOT_CONFIGURED');
    process.env.FAL_KEY = prev;
  });

  it('builds correct text payload and returns normalized result', async () => {
    mockFetchSequence([
      { body: { request_id: 'req-1' } }, // submit
      { body: { status: 'COMPLETED' } }, // poll
      {
        body: {
          request_id: 'req-1',
          video: { url: 'https://fal.media/out.mp4', content_type: 'video/mp4', file_size: 12345 },
          boundingbox_frames_zip: { url: 'https://fal.media/frames.zip', content_type: 'application/zip' },
        },
      },
    ]);
    const result = await segmentVideoWithSAM3({
      video_url: 'https://example.com/in.mp4',
      prompt: 'person',
    });
    expect(result.success).toBe(true);
    expect(result.provider).toBe('fal');
    expect(result.model).toBe('fal-ai/sam-3/video');
    expect(result.video.url).toBe('https://fal.media/out.mp4');
    expect(result.video.contentType).toBe('video/mp4');
    expect(result.boundingboxFramesZip.url).toBe('https://fal.media/frames.zip');
    // Validate the submit body shape
    const fetchMock = global.fetch;
    const submitCall = fetchMock.mock.calls[0];
    const submitBody = JSON.parse(submitCall[1].body);
    expect(submitBody.video_url).toBe('https://example.com/in.mp4');
    expect(submitBody.prompt).toBe('person');
    expect(submitBody.apply_mask).toBe(true);
    expect(submitBody.video_output_type).toBe('X264 (.mp4)');
    expect(submitBody.detection_threshold).toBe(0.5);
    expect(submitCall[1].headers.Authorization).toBe('Key test-fal-key');
  });

  it('maps point prompts with label=1 and object_id', async () => {
    mockFetchSequence([
      { body: { request_id: 'req-2' } },
      { body: { status: 'COMPLETED' } },
      { body: { request_id: 'req-2', video: { url: 'https://fal.media/o.mp4' } } },
    ]);
    await segmentVideoWithSAM3({
      video_url: 'https://example.com/in.mp4',
      pointPrompts: [
        { x: 120.4, y: 88.6, label: 1, objectId: 3 },
        { x: 10, y: 20 }, // no label/objectId -> defaults
      ],
    });
    const submitBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(submitBody.point_prompts).toEqual([
      { x: 120, y: 89, label: 1, object_id: 3 },
      { x: 10, y: 20, label: 1, object_id: 1 },
    ]);
  });

  it('maps box prompts with object_id', async () => {
    mockFetchSequence([
      { body: { request_id: 'req-3' } },
      { body: { status: 'COMPLETED' } },
      { body: { request_id: 'req-3', video: { url: 'https://fal.media/o.mp4' } } },
    ]);
    await segmentVideoWithSAM3({
      video_url: 'https://example.com/in.mp4',
      boxPrompts: [
        { xMin: 10.6, yMin: 20.4, xMax: 110.2, yMax: 220.8, objectId: 7 },
      ],
    });
    const submitBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(submitBody.box_prompts).toEqual([
      { x_min: 11, y_min: 20, x_max: 110, y_max: 221, object_id: 7 },
    ]);
  });

  it('rejects missing video_url with INVALID_VIDEO_URL', async () => {
    const result = await segmentVideoWithSAM3({ prompt: 'person' });
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_VIDEO_URL');
  });

  it('returns INVALID_SAM3_OUTPUT when result has no video.url', async () => {
    mockFetchSequence([
      { body: { request_id: 'req-4' } },
      { body: { status: 'COMPLETED' } },
      { body: { request_id: 'req-4' /* no video */ } },
    ]);
    const result = await segmentVideoWithSAM3({ video_url: 'https://example.com/in.mp4' });
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_SAM3_OUTPUT');
  });

  it('returns FAL_REQUEST_FAILED on HTTP error', async () => {
    mockFetchSequence([{ ok: false, status: 500, statusText: 'Server Error', body: { error: 'boom' } }]);
    const result = await segmentVideoWithSAM3({ video_url: 'https://example.com/in.mp4' });
    expect(result.success).toBe(false);
    expect(result.code).toBe('FAL_REQUEST_FAILED');
    expect(result.tool).toBe('sam3_segment');
  });

  it('returns FAL_REQUEST_FAILED when polling reports FAILED status', async () => {
    mockFetchSequence([
      { body: { request_id: 'req-fail' } }, // submit returns id
      { body: { status: 'FAILED', error: 'bad video' } }, // poll reports FAILED
    ]);
    const result = await segmentVideoWithSAM3({ video_url: 'https://example.com/in.mp4' });
    expect(result.success).toBe(false);
    expect(result.code).toBe('FAL_REQUEST_FAILED');
  });

  it('returns INVALID_SAM3_OUTPUT when submit has no request_id and no usable body', async () => {
    // Edge case: submit returns empty object, normalize throws INVALID_SAM3_OUTPUT
    mockFetchSequence([{ body: {} }]);
    const result = await segmentVideoWithSAM3({ video_url: 'https://example.com/in.mp4' });
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_SAM3_OUTPUT');
  });
});
