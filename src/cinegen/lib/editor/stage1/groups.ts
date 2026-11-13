// [remix] Stage 1: clip groups (pure). A group is a shared `groupId` on clips. Selecting one member selects them all (edit-tab expands the
// selection), so the existing multi-clip move / delete / duplicate paths act on the whole group. Unlike linked clips (A/V pairs) a group
// never changes how split or trim treat a clip.
import type { Clip, Timeline } from '@cinegen/types/timeline';
import { generateId } from '@cinegen/lib/utils/ids';

/** Select every member of the groups the given clips belong to. */
export function expandSelectionWithGroups(clips: Clip[], ids: Iterable<string>): Set<string> {
  const out = new Set(ids);
  const groups = new Set<string>();
  for (const c of clips) if (out.has(c.id) && c.groupId) groups.add(c.groupId);
  if (groups.size) for (const c of clips) if (c.groupId && groups.has(c.groupId)) out.add(c.id);
  return out;
}

/** Group the clips (two or more). Clips already in a group bring their whole group along (groups merge, never nest). */
export function groupClips(timeline: Timeline, ids: Iterable<string>): { timeline: Timeline; groupId: string | null } {
  const members = expandSelectionWithGroups(timeline.clips, ids);
  const present = timeline.clips.filter((c) => members.has(c.id));
  if (present.length < 2) return { timeline, groupId: null };
  const groupId = generateId();
  return { timeline: { ...timeline, clips: timeline.clips.map((c) => (members.has(c.id) ? { ...c, groupId } : c)) }, groupId };
}

/** Remove the groups the given clips belong to (all members are released). */
export function ungroupClips(timeline: Timeline, ids: Iterable<string>): Timeline {
  const sel = new Set(ids);
  const groups = new Set(timeline.clips.filter((c) => sel.has(c.id) && c.groupId).map((c) => c.groupId as string));
  if (!groups.size) return timeline;
  return { ...timeline, clips: timeline.clips.map((c) => { if (!c.groupId || !groups.has(c.groupId)) return c; const { groupId: _g, ...rest } = c; return rest as Clip; }) };
}
