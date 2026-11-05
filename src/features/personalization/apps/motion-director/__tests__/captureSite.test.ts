// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureSite } from '../lib/directorClient';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const capture = { url: 'https://acme.io/', title: 'Acme', page: { url: 'p', width: 1, height: 1 }, crops: [], brand: {} };

afterEach(() => vi.unstubAllGlobals());

describe('captureSite', () => {
  it('returns the capture when the server captured inside the request', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, capture)));
    await expect(captureSite('acme.io')).resolves.toMatchObject({ title: 'Acme' });
  });

  it('polls a background capture until it is done and reports progress', async () => {
    const statuses = [json(200, { state: 'running' }), json(404, { code: 'NOT_FOUND', error: 'No such capture' }), json(200, { state: 'done', capture })];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => (String(input).includes('/status') ? statuses.shift()! : json(202, { jobId: 'job-1', state: 'running' })));
    vi.stubGlobal('fetch', fetchMock);
    const progress: number[] = [];
    await expect(captureSite('acme.io', { pollMs: 1, onProgress: (s) => progress.push(s) })).resolves.toMatchObject({ title: 'Acme' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[1][0])).toContain('jobId=job-1');
    expect(progress.length).toBe(3);
  });

  it('fails at once with the job\'s own error', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (String(input).includes('/status') ? json(200, { state: 'error', code: 'URL_REJECTED', error: 'That address cannot be captured.' }) : json(202, { jobId: 'j' }))));
    await expect(captureSite('acme.io', { pollMs: 1 })).rejects.toMatchObject({ code: 'URL_REJECTED', message: 'That address cannot be captured.' });
  });

  it('stops waiting when cancelled, and gives up after the longest wait', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => (String(input).includes('/status') ? json(200, { state: 'running' }) : json(202, { jobId: 'j' })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(captureSite('acme.io', { pollMs: 1, cancelled: () => true })).rejects.toMatchObject({ code: 'CANCELLED' });
    await expect(captureSite('acme.io', { pollMs: 5, maxWaitMs: 30 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});
