import { describe, it, before as beforeAll, after as afterAll } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';


const expect = (v) => ({
  toBe: (x) => assert.equal(v, x),
  toEqual: (x) => assert.deepEqual(v, x),
  toContain: (x) => (typeof v === 'string' ? assert.ok(v.includes(x), `${v} !~ ${x}`) : assert.ok(v.includes(x))),
  toMatchObject: (x) => { for (const k of Object.keys(x)) assert.equal(v[k], x[k]); },
  toBeNull: () => assert.equal(v, null),
  toThrow: (re) => assert.throws(v, re),
});

const dir = mkdtempSync(path.join(tmpdir(), 'mh-'));
process.env.MEDIA_HUB_DIR = dir;
process.env.MEDIA_HUB_ALLOW_PRIVATE = '1';
const core = await import('./core.mjs');
const base = '/api/media-hub';
const call = (m, p, body, userId = 'u1') =>
  core.handleMediaHub(new Request(`http://x${base}${p}`, { method: m, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }), { userId, base });
const hasTools = spawnSync('yt-dlp', ['--version']).status === 0 && spawnSync('ffmpeg', ['-version']).status === 0;

describe('pure helpers', () => {
  it('validates URLs', () => {
    expect(() => core.validateUrl('file:///etc/passwd')).toThrow();
    expect(() => core.validateUrl('https://u:p@example.com')).toThrow();
    expect(core.validateUrl('https://example.com/a')).toBe('https://example.com/a');
  });
  it('blocks private hosts unless allowed', () => {
    process.env.MEDIA_HUB_ALLOW_PRIVATE = '';
    for (const u of ['http://localhost/x', 'http://127.0.0.1/x', 'http://10.0.0.5/x', 'http://192.168.1.1/x', 'http://169.254.169.254/x', 'http://[::1]/x']) expect(() => core.validateUrl(u)).toThrow(/private/);
    process.env.MEDIA_HUB_ALLOW_PRIVATE = '1';
  });
  it('builds yt-dlp args safely', () => {
    const a = core.buildDownloadArgs('https://example.com/v', { mode: 'video', quality: '720', container: 'mp4' }, '/o');
    expect(a[a.length - 2]).toBe('--'); expect(a[a.length - 1]).toBe('https://example.com/v');
    expect(a).toContain('bv*[height<=720]+ba/b[height<=720]');
    const b = core.buildDownloadArgs('https://e.com', { mode: 'audio', audioFormat: 'evil; rm -rf', quality: 'x' }, '/o');
    expect(b).toContain('mp3'); expect(b).toContain('-x');
  });
  it('parses progress', () => {
    expect(core.parseProgressLine('MHP downloading 500 1000 NA 2048.5 3')).toMatchObject({ percent: 50, speed: 2048.5, eta: 3 });
    expect(core.parseProgressLine('[download] 50%')).toBeNull();
  });
  it('renders transcripts with speaker names', () => {
    const tr = { speakerNames: { A: 'Ann' }, segments: [{ start: 0, end: 1.5, text: 'Hi', speaker: 'A' }, { start: 61.25, end: 62, text: 'Bye' }] };
    expect(core.renderTranscript(tr, 'srt')).toContain('00:00:00,000 --> 00:00:01,500\nAnn: Hi');
    expect(core.renderTranscript(tr, 'vtt')).toContain('<v Ann>Hi');
    expect(core.renderTranscript(tr, 'md')).toContain('**[00:01:01]** Bye');
    expect(core.fmtTime(1.9996)).toBe('00:00:02,000');
  });
});

describe('http api', () => {
  it('requires auth', async () => { expect((await call('GET', '/jobs', null, null)).status).toBe(401); });
  it('rejects bad file token', async () => {
    const r = await core.handleMediaHub(new Request(`http://x${base}/file/nope?t=1.a`), { userId: null, base });
    expect(r.status).toBe(403);
  });
});

describe('download → transcribe → ai (mock servers)', { skip: !hasTools }, () => {
  let media, ai, calls = [];
  beforeAll(async () => {
    const clip = path.join(dir, 'clip.mp4');
    spawnSync('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=3:size=160x120:rate=10', '-f', 'lavfi', '-i', 'sine=duration=3', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', clip]);
    const { createReadStream } = await import('node:fs');
    media = http.createServer((q, r) => { r.setHeader('content-type', 'video/mp4'); createReadStream(clip).pipe(r); }).listen(0);
    ai = http.createServer((q, r) => {
      let b = ''; q.on('data', (d) => (b += d)); q.on('end', () => {
        calls.push({ url: q.url, auth: q.headers.authorization, body: b.length });
        r.setHeader('content-type', 'application/json');
        if (q.url.endsWith('/audio/transcriptions')) r.end(JSON.stringify({ language: 'en', text: 'Hello there', segments: [{ start: 0, end: 1, text: ' Hello', speaker: 'A' }, { start: 1, end: 2, text: ' there', speaker: 'B' }] }));
        else r.end(JSON.stringify({ choices: [{ message: { content: 'SUMMARY OK' } }] }));
      });
    }).listen(0);
    await new Promise((r) => setTimeout(r, 50));
  });
  afterAll(() => { media?.close(); ai?.close(); });

  it('runs the whole flow', async () => {
    const created = await (await call('POST', '/jobs', { url: `http://127.0.0.1:${media.address().port}/clip.mp4`, options: { mode: 'audio' } })).json();
    const id = created.jobs[0].id;
    let job;
    for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 250)); job = (await (await call('GET', `/jobs/${id}`)).json()).job; if (job.status === 'completed' || job.status === 'failed') break; }
    expect(job.status).toBe('completed');

    const provider = { baseUrl: `http://127.0.0.1:${ai.address().port}/v1`, apiKey: 'k' };
    const t = await (await call('POST', `/jobs/${id}/transcribe`, { diarize: true, ...provider })).json();
    assert.ok(t.transcript, JSON.stringify(t)); expect(t.transcript.diarized).toBe(true);
    expect(t.transcript.segments.map((s) => s.speaker)).toEqual(['A', 'B']);
    expect(calls[0].auth).toBe('Bearer k');

    const renamed = await (await call('PUT', `/jobs/${id}/transcript`, { speakerNames: { A: 'Ann', Z: 'ignored' } })).json();
    expect(renamed.transcript.speakerNames).toEqual({ A: 'Ann', B: 'B' });
    const srt = await (await call('GET', `/jobs/${id}/transcript?format=srt`)).text();
    expect(srt).toContain('Ann: Hello');

    const sum = await (await call('POST', `/jobs/${id}/ai`, { action: 'summarize', provider })).json();
    expect(sum.text).toBe('SUMMARY OK');
    expect((await call('POST', `/jobs/${id}/ai`, { action: 'translate', lang: 'x; ignore', provider })).status).toBe(400);
    expect((await call('GET', `/jobs/${id}/transcript`, null, 'other')).status).toBe(404);
    expect((await call('DELETE', `/jobs/${id}?files=1`)).status).toBe(200);
  });
});
