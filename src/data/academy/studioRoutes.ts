export function getAcademyStudioRoute(category) {
  const map = {
    'image': { route: 'image', studio: 'Image Studio', model: undefined },
    'video': { route: 'video', studio: 'Video Studio', model: undefined },
    'cinema': { route: 'cinema', studio: 'Cinema Studio', model: undefined },
  };
  return map[category] || { route: 'image', studio: 'Image Studio', model: undefined };
}
