// [remix] Links a CineGen project to the Supabase `timeline_projects` row that the Analytics, Audience, Retarget and
// Notifications views are built on. CineGen keeps its own storage untouched; a lightweight row with the SAME id is
// written only when the project is published (or when an already-published project opens Analytics), so every
// published video can be tied to its project without changing how CineGen saves.
export interface LinkInput {
  projectId: string;
  name: string;
  /** The publish-state built from the timeline (classic shape). */
  built: { timelineSeconds?: number; [k: string]: unknown };
  aspect?: string | null;
}

// minimal structural type of the supabase-js client used here (query builder is chainable)
type Client = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isLinkableProjectId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id);

/**
 * The Supabase row id for one published timeline. A CineGen project can hold several timelines and each is published
 * separately, so every (project, timeline) pair gets its own deterministic uuid. That keeps each video's data, saved
 * interest mapping and analytics apart, and can never collide with a classic-editor row.
 */
export async function linkedProjectId(projectId: string, timelineId: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cinegen:${projectId}:${timelineId}`))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 version 5 layout
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** The owner's saved Retarget mapping for this project, so republishing keeps it. */
export async function readInterestMap(client: Client, projectId: string): Promise<unknown[] | null> {
  if (!isLinkableProjectId(projectId)) return null;
  const { data, error } = await client.from('timeline_projects').select('settings').eq('id', projectId).maybeSingle();
  if (error) throw new Error(error.message || 'Could not read the saved audience mapping');
  const m = data?.settings?.interestMap;
  return Array.isArray(m) ? m : null;
}

/**
 * Create or refresh the mirror row. Existing rows keep their `settings` (the owner's interest map lives there),
 * so only name, data, duration and aspect are updated.
 */
export async function ensureProjectRow(client: Client, input: LinkInput): Promise<void> {
  const { projectId, name, built, aspect } = input;
  if (!isLinkableProjectId(projectId)) throw new Error('This project cannot be linked yet');
  const fields = {
    name: (name || 'Untitled project').slice(0, 200),
    data: built,
    duration_s: Number.isFinite(built.timelineSeconds) ? built.timelineSeconds : null,
    aspect_ratio: aspect || '16:9',
  };
  const { data: existing, error: readErr } = await client.from('timeline_projects').select('id, settings').eq('id', projectId).maybeSingle();
  if (readErr) throw new Error(readErr.message || 'Could not read the project');
  // Never take over a row this feature did not create.
  if (existing && existing.settings?.source !== 'cinegen') throw new Error('This project id belongs to another project');
  const res = existing
    ? await client.from('timeline_projects').update(fields).eq('id', projectId)
    : await client.from('timeline_projects').insert({ id: projectId, ...fields, settings: { source: 'cinegen' } });
  if (res.error) throw new Error(res.error.message || 'Could not save the project');
}

/** Point an already-published video at its project (older CineGen publications had no link). */
export async function linkVideoToProject(client: Client, videoId: string, projectId: string): Promise<void> {
  const { error } = await client.from('published_videos').update({ project_id: projectId }).eq('id', videoId);
  if (error) throw new Error(error.message || 'Could not link the video to its project');
}
