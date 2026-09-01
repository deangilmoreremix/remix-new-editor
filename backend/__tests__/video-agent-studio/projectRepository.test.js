import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  InMemoryVideoAgentProjectRepository,
} from '../../services/video-agent-studio/projectRepository.js';

describe('VideoAgentProjectRepository', () => {
  let repo;
  beforeEach(() => {
    repo = new InMemoryVideoAgentProjectRepository();
  });

  it('creates a project owned by the user', async () => {
    const p = await repo.createProject('user-1', { name: 'My film' });
    expect(p.userId).toBe('user-1');
    expect(p.name).toBe('My film');
    expect(p.revision).toBe(1);
    expect(p.projectDoc).toEqual({});
  });

  it('refuses cross-user reads', async () => {
    const p = await repo.createProject('user-1', { name: 'A' });
    const got = await repo.getProject('user-2', p.id);
    expect(got).toBeNull();
  });

  it('refuses cross-user saves', async () => {
    const p = await repo.createProject('user-1', { name: 'A' });
    await expect(
      repo.saveProject('user-2', { projectId: p.id, projectDoc: { foo: 1 } }),
    ).rejects.toThrow();
  });

  it('increments revision on save and creates a version snapshot', async () => {
    const p = await repo.createProject('user-1', { name: 'A' });
    const saved = await repo.saveProject('user-1', {
      projectId: p.id,
      projectDoc: { tracks: [] },
    });
    expect(saved.revision).toBe(2);
    const versions = await repo.listVersions('user-1', p.id);
    expect(versions).toHaveLength(2);
    expect(versions[0].revision).toBe(2);
  });

  it('lists only the caller\'s projects', async () => {
    await repo.createProject('user-1', { name: 'A' });
    await repo.createProject('user-1', { name: 'B' });
    await repo.createProject('user-2', { name: 'C' });
    const { rows } = await repo.listProjects('user-1');
    expect(rows.map((r) => r.name).sort()).toEqual(['A', 'B']);
  });

  it('deletes a project only for the owner', async () => {
    const p = await repo.createProject('user-1', { name: 'A' });
    await expect(repo.deleteProject('user-2', p.id)).rejects.toThrow();
    await repo.deleteProject('user-1', p.id);
    expect(await repo.getProject('user-1', p.id)).toBeNull();
  });
});
