import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recastMock = vi.hoisted(() => ({
  submitRecast: vi.fn(),
  pollRecast: vi.fn(),
  persistRecastVideo: vi.fn(),
}));
const toastMock = vi.hoisted(() => vi.fn());

vi.mock('../fullBodyRecast.js', async (importOriginal) => ({
  ...(await importOriginal()),
  ...recastMock,
}));
vi.mock('../../loading.js', () => ({ showToast: toastMock }));

import {
  RECAST_MAX_RUN_MS,
  __resetRecastJobsForTests,
  cancelRecastJob,
  dismissRecastJob,
  getRecastJobs,
  resumeRecastJobs,
  retryRecastJob,
  startRecastJob,
  subscribeRecastJobs,
  waitForRecastJob,
} from '../recastJobs.js';
import { getProfile, saveProfile } from '../../contactStore.js';
import { getPrimaryPresenterVideo } from '../personalizationProfile.js';

const CONTACT = 'contact-1';
const STORAGE_KEY = 'remix_recast_jobs';
const params = {
  contactId: CONTACT,
  editorAssetId: 'ana',
  characterAssetId: 'ana',
  characterName: 'Ana',
  characterImageUrl: 'https://cdn.example.com/ana.png',
  sourceUrl: 'https://cdn.muapi.ai/source.mp4',
  duration: 7.4,
  prompt: 'keep the wave',
};

const storedJobs = () => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
const presenterVideos = () => getProfile(CONTACT)?.personalization?.assets?.presenterVideos || [];

beforeEach(() => {
  localStorage.clear();
  __resetRecastJobsForTests();
  Object.values(recastMock).forEach((fn) => fn.mockReset());
  toastMock.mockReset();
  recastMock.submitRecast.mockResolvedValue('req-1');
  recastMock.persistRecastVideo.mockImplementation(async (url) => ({ url: `${url}?stored`, durable: true }));
  saveProfile({ id: CONTACT, name: 'Ana Rivera' });
});

afterEach(() => __resetRecastJobsForTests());

describe('recast job store', () => {
  it('stores the request id before polling, then saves the video as the main presenter video', async () => {
    let requestIdAtPoll = null;
    recastMock.pollRecast.mockImplementation(async (requestId) => {
      requestIdAtPoll = storedJobs()[0].requestId;
      expect(requestId).toBe('req-1');
      return 'https://cdn.muapi.ai/out.mp4';
    });
    const statuses = [];
    subscribeRecastJobs((jobs) => statuses.push(jobs[0].status));

    const job = startRecastJob(params);
    expect(job.status).toBe('submitting');
    await waitForRecastJob(job.id);

    expect(requestIdAtPoll).toBe('req-1');
    expect(recastMock.submitRecast).toHaveBeenCalledWith({
      video_url: params.sourceUrl,
      images_list: [params.characterImageUrl],
      aspect_ratio: 'adaptive',
      duration: 7,
      generate_audio: false,
      prompt: 'keep the wave',
    });
    expect(statuses).toEqual(['submitting', 'running', 'saving', 'done']);
    expect(getRecastJobs({ contactId: CONTACT })[0]).toMatchObject({ status: 'done', savedUrl: 'https://cdn.muapi.ai/out.mp4?stored' });

    const videos = presenterVideos();
    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({ role: 'presenter_video', name: 'Ana — Full Body Recast', mimeType: 'video/mp4' });
    expect(videos[0].editMetadata).toMatchObject({ jobId: job.id, characterAssetId: 'ana', prompt: 'keep the wave' });
    expect(getPrimaryPresenterVideo(getProfile(CONTACT)).id).toBe(videos[0].id);
    expect(toastMock).toHaveBeenCalledWith(expect.stringMatching(/Recast ready for Ana/), 'success');
  });

  it('cancels without saving', async () => {
    recastMock.pollRecast.mockImplementation((_id, signal) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Request cancelled')));
    }));
    const job = startRecastJob(params);
    await vi.waitFor(() => expect(recastMock.pollRecast).toHaveBeenCalled());
    expect(cancelRecastJob(job.id)).toBe(true);
    await waitForRecastJob(job.id);
    expect(getRecastJobs()[0].status).toBe('cancelled');
    expect(presenterVideos()).toHaveLength(0);
    expect(cancelRecastJob(job.id)).toBe(false);
  });

  it('marks a failed submit as an error that cannot be retried', async () => {
    recastMock.submitRecast.mockRejectedValue(new Error('Muapi API key not configured.'));
    const job = startRecastJob(params);
    await waitForRecastJob(job.id);
    expect(getRecastJobs()[0]).toMatchObject({ status: 'error', error: 'Muapi API key not configured.', requestId: '' });
    expect(retryRecastJob(job.id)).toBe(false);
  });

  it('retries a polling error with the same request id', async () => {
    recastMock.pollRecast
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce('https://cdn.muapi.ai/out.mp4');
    const job = startRecastJob(params);
    await waitForRecastJob(job.id);
    expect(getRecastJobs()[0]).toMatchObject({ status: 'error', error: 'Network down' });

    expect(retryRecastJob(job.id)).toBe(true);
    await waitForRecastJob(job.id);
    expect(recastMock.submitRecast).toHaveBeenCalledTimes(1);
    expect(recastMock.pollRecast).toHaveBeenCalledTimes(2);
    expect(getRecastJobs()[0].status).toBe('done');
    expect(presenterVideos()).toHaveLength(1);
  });

  it('resumes a job saved by an earlier page load, exactly once', async () => {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{
      ...params, id: 'job-old', requestId: 'req-9', status: 'running', startedAt: now - 60_000, duration: 7,
    }]));
    __resetRecastJobsForTests();
    let resolvePoll;
    recastMock.pollRecast.mockImplementation(() => new Promise((resolve) => { resolvePoll = resolve; }));

    expect(resumeRecastJobs({ now })).toBe(1);
    expect(resumeRecastJobs({ now })).toBe(0);
    expect(recastMock.pollRecast).toHaveBeenCalledTimes(1);
    expect(recastMock.pollRecast).toHaveBeenCalledWith('req-9', expect.anything());

    resolvePoll('https://cdn.muapi.ai/out.mp4');
    await waitForRecastJob('job-old');
    expect(presenterVideos()).toHaveLength(1);
    expect(recastMock.submitRecast).not.toHaveBeenCalled();
  });

  it('times out stale jobs and jobs interrupted before submit', () => {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { ...params, id: 'stale', requestId: 'req-1', status: 'running', startedAt: now - RECAST_MAX_RUN_MS - 1000 },
      { ...params, id: 'unsent', requestId: '', status: 'submitting', startedAt: now - 1000 },
    ]));
    __resetRecastJobsForTests();
    expect(resumeRecastJobs({ now })).toBe(0);
    const byId = Object.fromEntries(getRecastJobs().map((job) => [job.id, job]));
    expect(byId.stale).toMatchObject({ status: 'error', error: expect.stringMatching(/Timed out/) });
    expect(byId.unsent).toMatchObject({ status: 'error', error: expect.stringMatching(/Try again/) });
    expect(recastMock.pollRecast).not.toHaveBeenCalled();
  });

  it('does not save the same job twice', async () => {
    recastMock.pollRecast.mockResolvedValue('https://cdn.muapi.ai/out.mp4');
    const job = startRecastJob(params);
    await waitForRecastJob(job.id);
    // Simulate another tab resuming the same job from a "saving" snapshot.
    const snapshot = storedJobs().map((entry) => ({ ...entry, status: 'saving', savedAssetId: '' }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    __resetRecastJobsForTests();
    resumeRecastJobs();
    await waitForRecastJob(job.id);
    expect(presenterVideos()).toHaveLength(1);
    expect(getRecastJobs()[0].status).toBe('done');
  });

  it('prunes old finished jobs and keeps at most 20', () => {
    const now = Date.now();
    const finished = Array.from({ length: 25 }, (_, i) => ({
      ...params, id: `done-${i}`, status: 'done', startedAt: now - i * 1000, finishedAt: now - i * 1000,
    }));
    const old = { ...params, id: 'old', status: 'done', startedAt: now - 2 * 86_400_000, finishedAt: now - 2 * 86_400_000 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...finished, old]));
    __resetRecastJobsForTests();
    const jobs = getRecastJobs();
    expect(jobs).toHaveLength(20);
    expect(jobs.some((job) => job.id === 'old')).toBe(false);
    expect(jobs[0].id).toBe('done-0');
  });

  it('dismisses finished jobs only and filters by contact', async () => {
    recastMock.pollRecast.mockResolvedValue('https://cdn.muapi.ai/out.mp4');
    const job = startRecastJob(params);
    expect(dismissRecastJob(job.id)).toBe(false);
    await waitForRecastJob(job.id);
    expect(getRecastJobs({ contactId: 'someone-else' })).toHaveLength(0);
    expect(dismissRecastJob(job.id)).toBe(true);
    expect(getRecastJobs()).toHaveLength(0);
  });

  it('requires a contact', () => {
    expect(() => startRecastJob({ ...params, contactId: '' })).toThrow(/contact/);
  });
});
