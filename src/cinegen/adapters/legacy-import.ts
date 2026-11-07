// [remix] One-time, non-destructive import of projects saved by the earlier Timeline Editor build (localStorage
// `remix.cinegen.workspace.v1[:id]`) into CineGen's project store. It writes the same database-shaped state CineGen's own
// WorkspaceShell saves (same db-converters), so the imported project opens like any other. The old keys are left in place.
import { assetToRow, clipToRow, trackToRow, transitionToRow } from '@cinegen/lib/db-converters';

const WORKSPACE = 'remix.cinegen.workspace.v1';
const INDEX = 'remix.cinegen.projects.v1';
const DONE = 'remix.cinegen.legacyImported.v1';

type Legacy = Record<string, any>;

function toDbState(projectId: string, name: string, s: Legacy) {
  const timelines = (s.timelines ?? []).map((tl: any) => ({
    id: tl.id, project_id: projectId, name: tl.name, duration: tl.duration, created_at: '',
    tracks: (tl.tracks ?? []).map((t: any, i: number) => trackToRow(t, tl.id, i)),
    clips: (tl.clips ?? []).map((c: any) => ({
      ...clipToRow(c, tl.id), created_at: '',
      keyframes: (c.keyframes ?? []).map((k: any) => ({ id: '', clip_id: c.id, time: k.time, property: k.property, value: k.value })),
    })),
    transitions: (tl.transitions ?? []).map((t: any) => transitionToRow(t, tl.id)),
    markers: JSON.stringify(tl.markers ?? []),
  }));
  const spaces = s.spaces ?? [];
  return {
    project: { id: projectId, name, created_at: '', updated_at: '', resolution_width: 1920, resolution_height: 1080, frame_rate: 24 },
    assets: (s.assets ?? []).map((a: any) => assetToRow(a, projectId)),
    mediaFolders: (s.mediaFolders ?? []).map((f: any) => ({ id: f.id, project_id: projectId, name: f.name, parent_id: f.parentId ?? null, created_at: f.createdAt ?? '' })),
    timelines,
    activeTimelineId: s.activeTimelineId,
    workflow: { nodes: s.nodes ?? [], edges: s.edges ?? [], spaces, activeSpaceId: s.activeSpaceId, openSpaceIds: s.openSpaceIds ?? spaces.map((x: any) => x.id), director: s.director },
    elements: s.elements ?? [],
    exports: [],
  };
}

export async function importLegacyProjects(): Promise<number> {
  let imported = 0;
  try {
    const done: string[] = JSON.parse(localStorage.getItem(DONE) || '[]');
    const names: Record<string, string> = {};
    try { for (const p of JSON.parse(localStorage.getItem(INDEX) || '[]')) names[p.id] = p.name; } catch { /* no index */ }
    const keys: Array<{ key: string; id: string }> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? '';
      if (k === WORKSPACE) keys.push({ key: k, id: 'timeline-editor' });
      else if (k.startsWith(`${WORKSPACE}:`)) keys.push({ key: k, id: k.slice(WORKSPACE.length + 1) });
    }
    for (const { key, id } of keys) {
      if (done.includes(key)) continue;
      const s: Legacy = JSON.parse(localStorage.getItem(key) || 'null');
      done.push(key);
      if (!s || (!(s.assets?.length) && !(s.timelines?.some((t: any) => t.clips?.length)) && !(s.elements?.length))) continue;
      const created = await window.electronAPI.db.createProject(names[id] || 'Imported project') as { project: { id: string } };
      await window.electronAPI.db.saveProject(created.project.id, toDbState(created.project.id, names[id] || 'Imported project', s));
      imported += 1;
    }
    localStorage.setItem(DONE, JSON.stringify(done));
  } catch (error) {
    console.warn('[legacy-import] skipped:', error);
  }
  return imported;
}
