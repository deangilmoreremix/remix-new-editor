// [remix] "Create follow-up" in Retarget, for a CineGen video: the follow-up becomes a real CineGen project (a copy of the
// original timeline with its media), linked to the original (parent_project_id + the brief) and opened in the timeline editor.
// The classic editor keeps its own flow (the Personalizer handoff in retarget/followup.js).
import { createAvailableProject, loadAvailableProject, saveAvailableProject } from '@cinegen/lib/cloud/projects';
import { linkedProjectId } from './project-link';
import { OPEN_PROJECT_EVENT } from './overview-deps';
// @ts-expect-error plain JS project store (Supabase timeline_projects)
import { createFollowupProject } from '../../../lib/editor/projectLibrary/projectStore.js';

interface OriginalRow { id: string; name?: string; settings?: Record<string, unknown> | null }
interface FollowupBrief { interest?: string | null; [key: string]: unknown }
interface SavedProject { project: Record<string, unknown>; timelines?: Array<Record<string, unknown>>; exports?: unknown[] }

/** The CineGen project and timeline a published row was mirrored from (set when it was published or opened in Analytics). */
export function cinegenSource(original: OriginalRow): { cinegenProjectId: string; timelineId: string } | null {
  const s = original.settings ?? {};
  const cinegenProjectId = typeof s.cinegenProjectId === 'string' ? s.cinegenProjectId : '';
  const timelineId = typeof s.timelineId === 'string' ? s.timelineId : '';
  return cinegenProjectId && timelineId ? { cinegenProjectId, timelineId } : null;
}

export async function openCinegenFollowup({ client, original, followup }: { client: unknown; original: OriginalRow; followup: FollowupBrief }): Promise<{ id: string }> {
  const source = cinegenSource(original);
  if (!source) throw new Error('This video was not made in the CineGen editor, so its follow-up cannot be opened here.');
  const topic = String(followup.interest || 'follow-up').slice(0, 60);

  const saved = JSON.parse(JSON.stringify(await loadAvailableProject<SavedProject>(source.cinegenProjectId, true))) as SavedProject;
  const name = `${String(saved.project?.name || original.name || 'Video')}: ${topic} follow-up`.slice(0, 120);
  const created = await createAvailableProject(name);
  const newId = created.project.id;

  // The copy keeps the timelines, tracks, clips, overlays and media references; only the project identity changes.
  const now = new Date().toISOString();
  const copy: SavedProject = {
    ...saved,
    project: { ...saved.project, id: newId, name, created_at: now, updated_at: now },
    timelines: (saved.timelines ?? []).map((t) => ({ ...t, project_id: newId })),
    exports: [], // nothing rendered or published yet
  };
  await saveAvailableProject(newId, copy, true);

  // The follow-up's own record is the new project's row, so its analytics, mapping and "Original vs follow-ups" line up.
  const rowId = await linkedProjectId(newId, source.timelineId);
  await createFollowupProject(client, original.id, followup, {
    id: rowId,
    settings: { ...(original.settings ?? {}), cinegenProjectId: newId, timelineId: source.timelineId },
  });

  window.dispatchEvent(new CustomEvent(OPEN_PROJECT_EVENT, { detail: { id: newId } }));
  return { id: newId };
}
