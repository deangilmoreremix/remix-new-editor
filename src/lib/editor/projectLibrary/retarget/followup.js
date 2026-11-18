/**
 * Launch a personalized follow-up from a recommendation using the EXISTING
 * personalization workflow (Personalizer + the shared handoff contract):
 *   1. a new project is saved, linked to the original (createFollowupProject),
 *   2. the brief travels in the existing sessionStorage handoff,
 *   3. the Personalizer opens (router `personalizer`) and consumes it.
 * No viewer is contacted: delivery requires an authorised integration that
 * this project does not have.
 */
import { createFollowupProject } from '../projectStore.js';
import { createPersonalizerHandoff, savePersonalizerHandoff } from '../../../personalizerHandoff.js';
import { getTimelineFollowupAsset } from '../../../personalizerAdapters.js';

export async function launchFollowup({ client, original, followup, navigate, videoUrl = null }) {
  if (!original?.id) throw new Error('Select a project first');
  if (!followup?.interest) throw new Error('Choose a recommendation first');
  const project = await createFollowupProject(client, original.id, followup);
  const handoff = createPersonalizerHandoff({
    studioId: 'timeline',
    studioName: 'Timeline Editor',
    route: 'timeline',
    project: { id: project.id, title: project.name },
    asset: getTimelineFollowupAsset({
      originalProjectId: original.id,
      originalProjectName: original.name,
      followupProjectId: project.id,
      interest: followup.interest,
      interestType: followup.interestType,
      ctaPurpose: followup.ctaPurpose,
      suggestedMessage: followup.suggestedMessage,
      originalVideoUrl: followup.originalVideoUrl || videoUrl,
      thumbnailUrl: original.thumbnail_url,
    }),
    returnRoute: 'timeline',
  });
  if (!savePersonalizerHandoff(handoff)) throw new Error('Could not hand the brief to the Personalizer');
  navigate?.('personalizer');
  return project;
}
