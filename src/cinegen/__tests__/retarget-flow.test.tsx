// @vitest-environment jsdom
// End to end for the header's Retarget button: click it on any tab and the Analytics tab shows its Retarget view,
// whether Analytics was closed (the request waits in sessionStorage) or already open (it hears the event).
import '@testing-library/jest-dom/vitest';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@cinegen/components/workspace/workspace-shell', () => ({
  useWorkspace: () => ({ state: { timelines: [{ id: 'tl-1' }], activeTimelineId: 'tl-1', assets: [], overlays: [] }, projectId: 'proj-1', dispatch: () => {} }),
}));
vi.mock('@cinegen/components/leads/use-publish', () => ({
  usePublished: () => ({ signedIn: true, loaded: true, info: { published: true }, id: 'vid-1', title: 'My video' }),
  getClient: async () => ({}),
}));
vi.mock('@cinegen/components/overview/published-overview', () => ({ PublishedOverview: () => null }));
vi.mock('@cinegen/lib/leads/publish-state', () => ({ buildPublishState: () => ({}) }));
vi.mock('@cinegen/lib/leads/thumbnail', () => ({ captureRowThumbnail: async () => undefined }));
vi.mock('@cinegen/lib/leads/followup-project', () => ({ openCinegenFollowup: async () => ({ id: 'x' }) }));
vi.mock('@cinegen/lib/leads/project-link', () => ({
  linkedProjectId: async () => 'row-1',
  rowName: async () => 'My video',
  ensureProjectRow: async () => undefined,
  linkVideoToProject: async () => undefined,
}));
const { stub } = vi.hoisted(() => ({ stub: (label: string) => () => (panel: HTMLElement) => { panel.textContent = label; } }));
vi.mock('../../lib/editor/projectLibrary/projectTabs.js', () => ({
  audienceTab: stub('AUDIENCE VIEW'), retargetTab: stub('RETARGET VIEW'), notificationsTab: stub('ALERTS VIEW'),
}));
vi.mock('../../lib/editor/projectLibrary/analytics/mountAnalyticsTab.jsx', () => ({
  mountAnalyticsTab: (panel: HTMLElement) => { panel.textContent = 'ANALYTICS VIEW'; return () => undefined; },
}));

import { TopTabs } from '@cinegen/components/workspace/top-tabs';
import type { ProjectTab as TabId } from '@cinegen/types/workspace';
import { AnalyticsTab } from '@cinegen/components/analytics/analytics-tab';
import { requestRetarget } from '@cinegen/lib/leads/open-retarget';

// The workspace shell does exactly this on click (workspace-shell.tsx handleOpenRetarget): request first, then switch tab.
function Host({ start }: { start: TabId }) {
  const [tab, setTab] = useState<TabId>(start);
  const openRetarget = useCallback(() => { requestRetarget(); setTab('analytics'); }, []);
  return (
    <>
      <TopTabs activeTab={tab} onTabChange={setTab} onOpenRetarget={openRetarget} />
      {tab === 'analytics' && <AnalyticsTab />}
    </>
  );
}

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('header Retarget button opens Analytics > Retarget', () => {
  it('from another tab (Analytics not mounted yet)', async () => {
    render(<Host start="edit" />);
    expect(screen.queryByTestId('analytics-tab')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Retarget' }));
    expect(await screen.findByText('RETARGET VIEW')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Retarget' })).toHaveAttribute('aria-selected', 'true');
    expect(store.has('remix_open_projects')).toBe(false); // the request was consumed
  });

  it('while Analytics is already open on another view', async () => {
    render(<Host start="analytics" />);
    expect(await screen.findByText('ANALYTICS VIEW')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Retarget' }));
    await waitFor(() => expect(screen.getByText('RETARGET VIEW')).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Retarget' })).toHaveAttribute('aria-selected', 'true');
  });
});
