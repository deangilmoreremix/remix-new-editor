import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const recastMock = vi.hoisted(() => ({
  readVideoDuration: vi.fn(),
  uploadRecastSource: vi.fn(),
  resolveRecastCharacterUrl: vi.fn(),
  submitRecast: vi.fn(),
  pollRecast: vi.fn(),
  persistRecastVideo: vi.fn(),
}));

vi.mock('../fullBodyRecast.js', async (importOriginal) => ({
  ...(await importOriginal()),
  ...recastMock,
}));
vi.mock('../../loading.js', () => ({ showToast: vi.fn() }));

import { PersonalizationImageEditorController } from '../imageEditorController.js';
import {
  __resetRecastJobsForTests,
  getRecastJobs,
  waitForRecastJob,
} from '../recastJobs.js';
import { getProfile, saveProfile } from '../../contactStore.js';

const CONTACT = 'contact-1';
const person = {
  id: 'person-1',
  name: 'Ana',
  url: 'https://cdn.example.com/ana.png',
  role: 'presenter_identity',
  sourceCategory: 'person',
};

/** Resolve pollRecast later, so tests can act while a job runs. */
function deferredPoll() {
  let resolve;
  let reject;
  recastMock.pollRecast.mockImplementation((_id, signal) => new Promise((res, rej) => {
    resolve = res;
    reject = rej;
    signal?.addEventListener('abort', () => rej(new Error('Request cancelled')));
  }));
  return { resolve: (url) => resolve(url), reject: (error) => reject(error) };
}

function openWithSource(controller, characters) {
  controller.open(person, { contactId: CONTACT });
  controller.openRecast(characters ? { characters } : undefined);
  Object.assign(controller.session.recast, { sourceUrl: 'https://cdn.muapi.ai/source.mp4', duration: 6 });
}

beforeEach(() => {
  localStorage.clear();
  __resetRecastJobsForTests();
  Object.values(recastMock).forEach((fn) => fn.mockReset());
  recastMock.resolveRecastCharacterUrl.mockImplementation(async (url) => url);
  recastMock.submitRecast.mockResolvedValue('req-1');
  recastMock.persistRecastVideo.mockImplementation(async (url) => ({ url: `${url}?stored`, durable: true }));
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
  saveProfile({ id: CONTACT, name: 'Ana Rivera' });
});

afterEach(() => __resetRecastJobsForTests());

describe('full body recast controller flow', () => {
  it('opens from the operation, uploads, and runs the recast as a background job that saves itself', async () => {
    const controller = new PersonalizationImageEditorController();
    controller.open(person, { contactId: CONTACT });
    await controller.runOperation('full_body_recast');
    expect(controller.session.mode).toBe('advanced');
    expect(controller.session.recast.open).toBe(true);

    recastMock.readVideoDuration.mockResolvedValue(6.2);
    recastMock.uploadRecastSource.mockResolvedValue('https://cdn.muapi.ai/source.mp4');
    await controller.setRecastSource({ type: 'video/mp4', size: 1000, name: 'take.mp4' });
    expect(controller.session.recast).toMatchObject({
      sourceName: 'take.mp4',
      sourcePreviewUrl: 'blob:preview',
      sourceUrl: 'https://cdn.muapi.ai/source.mp4',
      duration: 6.2,
      status: 'idle',
    });

    recastMock.pollRecast.mockResolvedValue('https://cdn.muapi.ai/out.mp4');
    controller.setRecastPrompt('wave hello');
    await controller.runRecast();
    const recast = controller.session.recast;
    expect(recast.jobId).toBeTruthy();
    await waitForRecastJob(recast.jobId);

    expect(recastMock.submitRecast).toHaveBeenCalledWith(expect.objectContaining({
      video_url: 'https://cdn.muapi.ai/source.mp4',
      images_list: ['https://cdn.example.com/ana.png'],
      duration: 6,
      prompt: 'wave hello',
    }));
    expect(recast).toMatchObject({ status: 'done', saved: true, resultUrl: 'https://cdn.muapi.ai/out.mp4?stored' });
    const video = getProfile(CONTACT).personalization.assets.presenterVideos[0];
    expect(video).toMatchObject({ role: 'presenter_video', url: 'https://cdn.muapi.ai/out.mp4?stored', mimeType: 'video/mp4' });
  });

  it('keeps the recast running when the editor closes, and re-attaches when reopened', async () => {
    const poll = deferredPoll();
    const controller = new PersonalizationImageEditorController();
    openWithSource(controller);
    await controller.runRecast();
    const jobId = controller.session.recast.jobId;
    await vi.waitFor(() => expect(recastMock.pollRecast).toHaveBeenCalled());

    controller.close();
    expect(getRecastJobs({ contactId: CONTACT })[0]).toMatchObject({ id: jobId, status: 'running' });

    controller.open(person, { contactId: CONTACT });
    controller.openRecast();
    expect(controller.session.recast).toMatchObject({
      jobId,
      status: 'generating',
      sourceUrl: 'https://cdn.muapi.ai/source.mp4',
      sourcePreviewUrl: 'https://cdn.muapi.ai/source.mp4',
    });

    poll.resolve('https://cdn.muapi.ai/out.mp4');
    await waitForRecastJob(jobId);
    expect(controller.session.recast).toMatchObject({ status: 'done', saved: true });
  });

  it('rejects clips outside the duration window without uploading', async () => {
    const controller = new PersonalizationImageEditorController();
    controller.open(person, { contactId: CONTACT });
    controller.openRecast();
    recastMock.readVideoDuration.mockResolvedValue(45);
    await controller.setRecastSource({ type: 'video/mp4', size: 1000, name: 'long.mp4' });
    expect(recastMock.uploadRecastSource).not.toHaveBeenCalled();
    expect(controller.session.recast.status).toBe('error');
    expect(controller.session.recast.error).toMatch(/30 seconds/);
  });

  it('cancels through the job store and returns to idle', async () => {
    deferredPoll();
    const controller = new PersonalizationImageEditorController();
    openWithSource(controller);
    await controller.runRecast();
    const jobId = controller.session.recast.jobId;
    await vi.waitFor(() => expect(recastMock.pollRecast).toHaveBeenCalled());

    controller.cancelRecast();
    await waitForRecastJob(jobId);
    expect(getRecastJobs()[0].status).toBe('cancelled');
    expect(controller.session.recast).toMatchObject({ status: 'idle', error: '', jobId: '' });
    expect(getProfile(CONTACT).personalization?.assets?.presenterVideos || []).toHaveLength(0);
  });

  it('offers Retry after a polling error and re-checks the same request', async () => {
    recastMock.pollRecast.mockRejectedValueOnce(new Error('Network down'));
    const controller = new PersonalizationImageEditorController();
    openWithSource(controller);
    await controller.runRecast();
    const jobId = controller.session.recast.jobId;
    await waitForRecastJob(jobId);
    expect(controller.session.recast).toMatchObject({ status: 'error', error: 'Network down', canRetry: true });

    recastMock.pollRecast.mockResolvedValueOnce('https://cdn.muapi.ai/out.mp4');
    controller.retryRecast();
    await waitForRecastJob(jobId);
    expect(recastMock.submitRecast).toHaveBeenCalledTimes(1);
    expect(recastMock.pollRecast).toHaveBeenLastCalledWith('req-1', expect.anything());
    expect(controller.session.recast).toMatchObject({ status: 'done', saved: true });
  });

  it('asks for a contact before starting', async () => {
    const controller = new PersonalizationImageEditorController();
    controller.open(person);
    controller.openRecast();
    Object.assign(controller.session.recast, { sourceUrl: 'https://cdn.muapi.ai/source.mp4', duration: 5 });
    await controller.runRecast();
    expect(recastMock.submitRecast).not.toHaveBeenCalled();
    expect(controller.session.recast.error).toMatch(/Select a contact/);
  });

  it('recasts with another saved person and clears a stale result', async () => {
    recastMock.pollRecast.mockResolvedValue('https://cdn/new.mp4');
    const controller = new PersonalizationImageEditorController();
    openWithSource(controller, [
      { id: 'person-1', name: 'Ana', url: 'https://cdn.example.com/ana.png' },
      { id: 'person-2', name: 'Ben', url: 'https://cdn.example.com/ben.png' },
    ]);
    const recast = controller.session.recast;
    expect(recast.characters.map((c) => c.id)).toEqual(['person-1', 'person-2']);
    expect(recast.characterId).toBe('person-1');

    Object.assign(recast, { status: 'done', resultUrl: 'https://cdn/old.mp4', saved: true });
    controller.setRecastCharacter('person-2');
    expect(recast).toMatchObject({ characterId: 'person-2', resultUrl: '', saved: false, status: 'idle' });

    await controller.runRecast();
    await waitForRecastJob(recast.jobId);
    expect(recastMock.resolveRecastCharacterUrl).toHaveBeenCalledWith('https://cdn.example.com/ben.png', expect.objectContaining({ name: 'Ben' }));
    expect(recastMock.submitRecast.mock.calls[0][0].images_list).toEqual(['https://cdn.example.com/ben.png']);
    const video = getProfile(CONTACT).personalization.assets.presenterVideos[0];
    expect(video.name).toBe('Ben — Full Body Recast');
    expect(video.editMetadata.characterAssetId).toBe('person-2');
  });

  it('uses the edited version for the asset being edited, and Recast Another keeps the person', () => {
    const controller = new PersonalizationImageEditorController();
    controller.open(person, { contactId: CONTACT });
    controller.session.versions.push({ ...controller.session.versions[0], id: 'v1', label: 'Cutout', dataUrl: 'data:image/png;base64,EDIT' });
    controller.session.versionIndex = 1;
    controller.openRecast({ characters: [{ id: 'person-2', name: 'Ben', url: 'https://cdn.example.com/ben.png' }] });
    expect(controller.recastCharacterUrl()).toBe('data:image/png;base64,EDIT');

    controller.setRecastCharacter('person-2');
    Object.assign(controller.session.recast, { sourceUrl: 'https://cdn/s.mp4', resultUrl: 'https://cdn/r.mp4', status: 'done', saved: true });
    controller.recastAnother();
    expect(controller.session.recast).toMatchObject({ characterId: 'person-2', sourceUrl: '', resultUrl: '', saved: false, status: 'idle', jobId: '' });
  });

  it('ignores unknown people', () => {
    const controller = new PersonalizationImageEditorController();
    controller.open(person, { contactId: CONTACT });
    controller.openRecast();
    controller.setRecastCharacter('nobody');
    expect(controller.session.recast.characterId).toBe('person-1');
  });
});
