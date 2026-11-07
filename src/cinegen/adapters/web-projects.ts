// [remix] Browser project store for CineGen's Project Manager (replaces its SQLite/cloud project list).
// A project is one workspace saved in browser storage; the list is a small index.
export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  assetCount: number;
  elementCount: number;
  thumbnail: string | null;
  useSqlite?: boolean;
  cloud?: boolean;
  cloudRole?: 'owner' | 'editor';
  cloudTeamName?: string;
  cloudCanDelete?: boolean;
}

const INDEX = 'remix.cinegen.projects.v1';
const LAST = 'remix.cinegen.lastProject.v1';
export const workspaceKey = (id: string) => `remix.cinegen.workspace.v1:${id}`;
export const DEFAULT_PROJECT_ID = 'timeline-editor';

function readIndex(): ProjectMeta[] {
  try { return JSON.parse(localStorage.getItem(INDEX) || '[]'); } catch { return []; }
}
function writeIndex(list: ProjectMeta[]) { try { localStorage.setItem(INDEX, JSON.stringify(list)); } catch { /* quota */ } }

export async function listAvailableProjects(): Promise<ProjectMeta[]> {
  const list = readIndex();
  if (!list.some((p) => p.id === DEFAULT_PROJECT_ID)) {
    const now = new Date().toISOString();
    // The pre-existing single project keeps its saved data.
    list.unshift({ id: DEFAULT_PROJECT_ID, name: 'Untitled Project', createdAt: now, updatedAt: now, assetCount: 0, elementCount: 0, thumbnail: null });
    writeIndex(list);
  }
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createAvailableProject(name: string): Promise<{ project: ProjectMeta }> {
  const now = new Date().toISOString();
  const project: ProjectMeta = { id: `p-${Date.now().toString(36)}`, name, createdAt: now, updatedAt: now, assetCount: 0, elementCount: 0, thumbnail: null };
  writeIndex([project, ...readIndex()]);
  return { project };
}

export async function deleteAvailableProject(project: ProjectMeta): Promise<void> {
  try { localStorage.removeItem(workspaceKey(project.id)); } catch { /* ignore */ }
  writeIndex(readIndex().filter((p) => p.id !== project.id));
}

/** Called by the workspace when it saves, so the manager shows fresh counts and times. */
export function touchProject(id: string, patch: Partial<ProjectMeta>) {
  const list = readIndex();
  const i = list.findIndex((p) => p.id === id);
  if (i < 0) return;
  list[i] = { ...list[i], ...patch, updatedAt: new Date().toISOString() };
  writeIndex(list);
}

export const getLastProjectId = () => { try { return localStorage.getItem(LAST) || DEFAULT_PROJECT_ID; } catch { return DEFAULT_PROJECT_ID; } };
export const setLastProjectId = (id: string) => { try { localStorage.setItem(LAST, id); } catch { /* ignore */ } };
