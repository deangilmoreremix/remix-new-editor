import request from 'supertest';
import app from '../server.js';

const pollUntilDone = async (jobId, timeoutMs = 90000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await request(app).get(`/videoagent/job/${jobId}`);
    if (r.body.status === 'completed' || r.body.status === 'failed') return r.body;
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error('Job polling timed out');
};

describe('VideoAgent API', () => {
  test('POST /videoagent/process requires an action', async () => {
    const res = await request(app).post('/videoagent/process').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing action/);
  });

  test('POST /videoagent/process rejects unknown actions', async () => {
    const res = await request(app).post('/videoagent/process').send({ action: 'bogus' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported action/);
  });

  test('process-tool requires a tool id', async () => {
    const res = await request(app)
      .post('/videoagent/process')
      .send({ action: 'process-tool' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing tool/);
  });

  test('scene-detection returns a job and completes with real ffmpeg', async () => {
    const start = await request(app)
      .post('/videoagent/process')
      .send({ action: 'process-tool', tool: 'scene-detection' });
    expect(start.status).toBe(200);
    expect(start.body.jobId).toBeDefined();
    expect(start.body.status).toBe('processing');

    const final = await pollUntilDone(start.body.jobId);
    expect(final.status).toBe('completed');
    expect(Array.isArray(final.scenes)).toBe(true);
    expect(typeof final.totalScenes).toBe('number');
  }, 90000);

  test('upscale returns a real ffmpeg output file', async () => {
    const start = await request(app)
      .post('/videoagent/process')
      .send({ action: 'process-tool', tool: 'upscale' });
    const final = await pollUntilDone(start.body.jobId);
    expect(final.status).toBe('completed');
    expect(final.upscaledVideo).toMatch(/\.mp4$/);
  }, 90000);

  test('color-correct completes with a processed video', async () => {
    const start = await request(app)
      .post('/videoagent/process')
      .send({ action: 'process-tool', tool: 'color-correct' });
    const final = await pollUntilDone(start.body.jobId);
    expect(final.status).toBe('completed');
    expect(final.correctedVideo).toMatch(/\.mp4$/);
  }, 90000);

  test('stabilize completes with a processed video', async () => {
    const start = await request(app)
      .post('/videoagent/process')
      .send({ action: 'process-tool', tool: 'stabilize' });
    const final = await pollUntilDone(start.body.jobId);
    expect(final.status).toBe('completed');
    expect(final.stabilizedVideo).toMatch(/\.mp4$/);
  }, 90000);

  test('dubbing completes (synthesizes/mixes audio when key present)', async () => {
    const start = await request(app)
      .post('/videoagent/process')
      .send({ action: 'process-tool', tool: 'dubbing', targetLanguage: 'es' });
    const final = await pollUntilDone(start.body.jobId);
    expect(final.status).toBe('completed');
    expect(final.dubbedVideo).toMatch(/\.mp4$/);
  }, 90000);

  test('process-usecase music-video runs real ffmpeg steps', async () => {
    const start = await request(app)
      .post('/videoagent/process')
      .send({ action: 'process-usecase', usecase: 'music-video' });
    const final = await pollUntilDone(start.body.jobId);
    expect(final.status).toBe('completed');
    expect(final.result).toBeDefined();
  }, 90000);

  test('full-pipeline completes through real ffmpeg stages', async () => {
    const start = await request(app)
      .post('/videoagent/process')
      .send({ action: 'full-pipeline' });
    const final = await pollUntilDone(start.body.jobId);
    expect(final.status).toBe('completed');
    expect(Array.isArray(final.stages)).toBe(true);
    expect(final.pipeline).toBe('completed');
  }, 90000);

  test('GET /videoagent/job/:id returns 404 for unknown jobs', async () => {
    const res = await request(app).get('/videoagent/job/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.status).toBe('not_found');
  });

  test('POST /videoagent/transcribe fails without OPENAI_API_KEY', async () => {
    const res = await request(app).post('/videoagent/transcribe').send({ input: 'x' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Transcription failed/);
  });

  test('POST /videoagent/tts/synthesize requires text', async () => {
    const res = await request(app).post('/videoagent/tts/synthesize').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/text is required/);
  });
});
