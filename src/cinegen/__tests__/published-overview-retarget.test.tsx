// @vitest-environment jsdom
// A studio's Retarget button leaves a project row id behind; the Analytics overview opens that video's Retarget view.
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';

const panel = vi.hoisted(() => ({ openProject: vi.fn().mockResolvedValue(true), openMostUnread: vi.fn(), destroy: vi.fn() }));
vi.mock('../../lib/editor/projectLibrary/projectsPanel.js', () => ({ renderProjectsPanel: () => panel }));
vi.mock('@cinegen/lib/leads/overview-deps', () => ({ createOverviewDeps: () => ({}), OPEN_PROJECT_EVENT: 'x' }));
vi.mock('@cinegen/components/overview/unlinked-videos', () => ({ UnlinkedVideos: () => null }));
vi.mock('@cinegen/components/overview/external-video-card', () => ({ ExternalVideoCard: () => null }));

import { PublishedOverview } from '@cinegen/components/overview/published-overview';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear(); panel.openProject.mockClear();
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Analytics overview opened from a studio\'s Retarget button', () => {
  it('opens that video\'s Retarget view and uses the request up', async () => {
    store.set('remix_open_retarget_project', 'row-uuid');
    render(<PublishedOverview />);
    await waitFor(() => expect(panel.openProject).toHaveBeenCalledWith('row-uuid', 'retarget'));
    expect(store.has('remix_open_retarget_project')).toBe(false);
  });
  it('opens nothing special when no studio asked', () => {
    render(<PublishedOverview />);
    expect(panel.openProject).not.toHaveBeenCalled();
  });
});
