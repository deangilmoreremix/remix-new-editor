import { beforeEach, describe, expect, it, vi } from 'vitest';

const recastMock = vi.hoisted(() => ({
  readVideoDuration: vi.fn(),
  uploadRecastSource: vi.fn(),
  resolveRecastCharacterUrl: vi.fn(),
  runFullBodyRecast: vi.fn(),
  persistRecastVideo: vi.fn(),
}));

vi.mock('../fullBodyRecast.js', async (importOriginal) => ({
  ...(await importOriginal()),
  ...recastMock,
}));

import { PersonalizationImageEditorController } from '../imageEditorController.js';

const person = {
  id: 'person-1',
  name: 'Ana',
  url: 'https://cdn.example.com/ana.png',
  role: 'presenter_identity',
  sourceCategory: 'person',
};

beforeEach(() => {
  Object.values(recastMock).forEach((fn) => fn.mockReset());
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('full body recast controller flow', () => {
  it('opens from the operation, uploads, recasts and builds a presenter video asset', async () => {
    const controller = new PersonalizationImageEditorController();
    controller.open(person);
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

    recastMock.resolveRecastCharacterUrl.mockResolvedValue('https://cdn.example.com/ana.png');
    recastMock.runFullBodyRecast.mockResolvedValue({ url: 'https://cdn.muapi.ai/out.mp4', model: 'seedance-2.5-motion-control' });
    controller.setRecastPrompt('wave hello');
    await controller.runRecast();
    expect(recastMock.runFullBodyRecast).toHaveBeenCalledWith(expect.objectContaining({
      sourceUrl: 'https://cdn.muapi.ai/source.mp4',
      characterUrl: 'https://cdn.example.com/ana.png',
      duration: 6.2,
      prompt: 'wave hello',
    }));
    expect(controller.session.recast).toMatchObject({ status: 'done', resultUrl: 'https://cdn.muapi.ai/out.mp4' });

    recastMock.persistRecastVideo.mockResolvedValue({ url: 'https://storage.example.com/out.mp4', durable: true });
    const fields = await controller.saveRecast();
    expect(fields).toMatchObject({
      role: 'presenter_video',
      url: 'https://storage.example.com/out.mp4',
      mimeType: 'video/mp4',
      editMetadata: { operation: 'full_body_recast', model: 'seedance-2.5-motion-control' },
    });
  });

  it('rejects clips outside the duration window without uploading', async () => {
    const controller = new PersonalizationImageEditorController();
    controller.open(person);
    controller.openRecast();
    recastMock.readVideoDuration.mockResolvedValue(45);
    await controller.setRecastSource({ type: 'video/mp4', size: 1000, name: 'long.mp4' });
    expect(recastMock.uploadRecastSource).not.toHaveBeenCalled();
    expect(controller.session.recast.status).toBe('error');
    expect(controller.session.recast.error).toMatch(/30 seconds/);
  });

  it('returns to idle without an error when the recast is cancelled', async () => {
    const controller = new PersonalizationImageEditorController();
    controller.open(person);
    controller.openRecast();
    Object.assign(controller.session.recast, { sourceUrl: 'https://cdn.muapi.ai/source.mp4', duration: 5 });
    recastMock.resolveRecastCharacterUrl.mockResolvedValue('https://cdn.example.com/ana.png');
    recastMock.runFullBodyRecast.mockImplementation(({ signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Request cancelled by user')));
    }));

    const pending = controller.runRecast();
    await vi.waitFor(() => expect(recastMock.runFullBodyRecast).toHaveBeenCalled());
    controller.cancelRecast();
    await pending;
    expect(controller.session.recast.status).toBe('idle');
    expect(controller.session.recast.error).toBe('');
  });

  it('recasts with another saved person and clears a stale result', async () => {
    const controller = new PersonalizationImageEditorController();
    controller.open(person);
    controller.openRecast({
      characters: [
        { id: 'person-1', name: 'Ana', url: 'https://cdn.example.com/ana.png' },
        { id: 'person-2', name: 'Ben', url: 'https://cdn.example.com/ben.png' },
      ],
    });
    const recast = controller.session.recast;
    expect(recast.characters.map((c) => c.id)).toEqual(['person-1', 'person-2']);
    expect(recast.characterId).toBe('person-1');

    Object.assign(recast, { sourceUrl: 'https://cdn.muapi.ai/source.mp4', duration: 5, status: 'done', resultUrl: 'https://cdn/old.mp4', saved: true });
    controller.setRecastCharacter('person-2');
    expect(recast).toMatchObject({ characterId: 'person-2', resultUrl: '', saved: false, status: 'idle' });

    recastMock.resolveRecastCharacterUrl.mockImplementation(async (url) => url);
    recastMock.runFullBodyRecast.mockResolvedValue({ url: 'https://cdn/new.mp4', model: 'seedance-2.5-motion-control' });
    await controller.runRecast();
    expect(recastMock.resolveRecastCharacterUrl).toHaveBeenCalledWith('https://cdn.example.com/ben.png', expect.objectContaining({ name: 'Ben' }));
    expect(recastMock.runFullBodyRecast.mock.calls[0][0].characterUrl).toBe('https://cdn.example.com/ben.png');
    expect(recast.startedAt).toBeGreaterThan(0);

    recastMock.persistRecastVideo.mockResolvedValue({ url: 'https://storage/new.mp4', durable: true });
    const fields = await controller.saveRecast();
    expect(fields.name).toBe('Ben — Full Body Recast');
    expect(fields.editMetadata.characterAssetId).toBe('person-2');
  });

  it('uses the edited version for the asset being edited, and Recast Another keeps the person', async () => {
    const controller = new PersonalizationImageEditorController();
    controller.open(person);
    controller.session.versions.push({ ...controller.session.versions[0], id: 'v1', label: 'Cutout', dataUrl: 'data:image/png;base64,EDIT' });
    controller.session.versionIndex = 1;
    controller.openRecast({ characters: [{ id: 'person-2', name: 'Ben', url: 'https://cdn.example.com/ben.png' }] });
    expect(controller.recastCharacterUrl()).toBe('data:image/png;base64,EDIT');

    controller.setRecastCharacter('person-2');
    Object.assign(controller.session.recast, { sourceUrl: 'https://cdn/s.mp4', resultUrl: 'https://cdn/r.mp4', status: 'done', saved: true });
    controller.recastAnother();
    expect(controller.session.recast).toMatchObject({ characterId: 'person-2', sourceUrl: '', resultUrl: '', saved: false, status: 'idle' });
  });

  it('ignores unknown people', () => {
    const controller = new PersonalizationImageEditorController();
    controller.open(person);
    controller.openRecast();
    controller.setRecastCharacter('nobody');
    expect(controller.session.recast.characterId).toBe('person-1');
  });
});
