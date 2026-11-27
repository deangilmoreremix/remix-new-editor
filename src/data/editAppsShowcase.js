// The muapi "Apps" in the Edit Studio, as plain data for the Edit Studio guide page.
//
// Pure (no JSON import, no DOM) so the build-time prerender (scripts/build-studio-guides.mjs) and the
// browser build the same showcase. Which apps are listed follows the Edit Studio itself: an app that
// is already in this repo is not in the Edit Studio, so it is not shown here either.

export const APP_CATEGORY_ORDER = [
  'professional', 'enhance-style', 'face-identity', 'video-editing', 'ads', 'games-characters', 'trending-templates',
];

const THIS_REPO = 'remix-new-editor';

/** True when the same tool already exists in this repo (so the Edit Studio does not add a second copy). */
export function isAlreadyInThisRepo(app) {
  return (app.existingIn || []).some((x) => x.repo === THIS_REPO && x.match !== 'similar');
}

/**
 * @param {{ apps: object[] }} appsMap  src/data/muapiStudioAppsMap.json
 * @returns {{ total: number, groups: { key: string, label: string, apps: object[] }[] }}
 */
export function buildAppsShowcase(appsMap) {
  const apps = (appsMap?.apps || []).filter((a) => !isAlreadyInThisRepo(a));
  const groups = APP_CATEGORY_ORDER
    .map((key) => {
      const inGroup = apps.filter((a) => a.studioCategoryKey === key);
      return {
        key,
        label: inGroup[0]?.studioTab || key,
        apps: inGroup.map((a) => ({
          slug: `app-${a.id}`,
          name: a.name,
          description: a.description || '',
          kind: a.mediaType === 'video' ? 'video' : 'image',
          thumbnail: a.thumbnail || '',
        })),
      };
    })
    .filter((g) => g.apps.length);
  return { total: groups.reduce((n, g) => n + g.apps.length, 0), groups };
}
