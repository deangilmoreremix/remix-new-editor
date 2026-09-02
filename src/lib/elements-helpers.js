/**
 * Elements panel prompts and labels — ported from CineGen.
 * These are pure functions and can be tested without React or API mocks.
 */

export function buildIndividualPrompts(type, description) {
  const COMMON_SUFFIX = 'Use a clean, neutral plain background. Photographic style with even, consistent lighting, natural controlled shadows, and sharp details.';

  switch (type) {
    case 'character':
      return [
        `Full-body front view of ${description} standing in a relaxed A-pose. ${COMMON_SUFFIX}`,
        `Full-body left profile view of ${description} standing in a relaxed A-pose, facing left. ${COMMON_SUFFIX}`,
        `Full-body right profile view of ${description} standing in a relaxed A-pose, facing right. ${COMMON_SUFFIX}`,
        `Full-body back view of ${description} standing in a relaxed A-pose, seen from behind. ${COMMON_SUFFIX}`,
        `Highly detailed close-up front portrait of ${description}, head and shoulders. ${COMMON_SUFFIX}`,
        `Highly detailed close-up left profile portrait of ${description}, head and shoulders, facing left. ${COMMON_SUFFIX}`,
        `Highly detailed close-up right profile portrait of ${description}, head and shoulders, facing right. ${COMMON_SUFFIX}`,
      ];

    case 'location':
      return [
        `Wide establishing front/entrance view of ${description}. ${COMMON_SUFFIX}`,
        `Wide establishing view of ${description} from a 45-degree left angle. ${COMMON_SUFFIX}`,
        `Wide establishing view of ${description} from a 45-degree right angle. ${COMMON_SUFFIX}`,
        `Aerial overhead view of ${description}. ${COMMON_SUFFIX}`,
        `Detailed close-up of key architectural or environmental detail of ${description}. ${COMMON_SUFFIX}`,
        `Detailed close-up of textures and materials of ${description}. ${COMMON_SUFFIX}`,
        `Atmospheric mood shot of ${description} showing time-of-day lighting. ${COMMON_SUFFIX}`,
      ];

    case 'prop':
      return [
        `Front view of ${description} on a neutral background. ${COMMON_SUFFIX}`,
        `Left side view of ${description}, rotated 90 degrees. ${COMMON_SUFFIX}`,
        `Right side view of ${description}, rotated 90 degrees. ${COMMON_SUFFIX}`,
        `Back view of ${description} on a neutral background. ${COMMON_SUFFIX}`,
        `Top-down view of ${description} showing full detail. ${COMMON_SUFFIX}`,
        `Detailed close-up of key detail or mechanism of ${description}. ${COMMON_SUFFIX}`,
        `Detailed close-up of texture and material surface of ${description}. ${COMMON_SUFFIX}`,
      ];

    case 'vehicle':
      return [
        `Front head-on view of ${description} on a neutral background. ${COMMON_SUFFIX}`,
        `Left profile view (driver side) of ${description}. ${COMMON_SUFFIX}`,
        `Right profile view (passenger side) of ${description}. ${COMMON_SUFFIX}`,
        `Rear view of ${description} on a neutral background. ${COMMON_SUFFIX}`,
        `Three-quarter front hero angle view of ${description}. ${COMMON_SUFFIX}`,
        `Interior cockpit view of ${description}. ${COMMON_SUFFIX}`,
        `Detailed close-up of a key defining feature of ${description} (engine, wheels, or signature detail). ${COMMON_SUFFIX}`,
      ];

    default:
      return [];
  }
}

export function buildPanelLabels(type) {
  switch (type) {
    case 'character':
      return ['Front', 'Left Profile', 'Right Profile', 'Back', 'Front Portrait', 'Left Portrait', 'Right Portrait'];
    case 'location':
      return ['Front/Entrance', 'Left Angle', 'Right Angle', 'Aerial', 'Key Detail', 'Textures', 'Atmosphere'];
    case 'prop':
      return ['Front', 'Left Side', 'Right Side', 'Back', 'Top-Down', 'Detail', 'Texture'];
    case 'vehicle':
      return ['Front', 'Left Profile', 'Right Profile', 'Rear', 'Hero Angle', 'Interior', 'Key Detail'];
    default:
      return [];
  }
}

export const ELEMENT_TYPES = ['character', 'location', 'prop', 'vehicle'];

export function createElementImage(params = {}) {
  return {
    id: params.id || `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    url: params.url,
    createdAt: params.createdAt || new Date().toISOString(),
    source: params.source || 'generated',
  };
}

export function createElement(params = {}) {
  return {
    id: params.id || `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name: params.name,
    type: params.type,
    description: params.description || '',
    images: params.images || [],
    createdAt: params.createdAt || new Date().toISOString(),
    updatedAt: params.updatedAt || new Date().toISOString(),
  };
}
