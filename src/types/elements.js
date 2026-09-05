/**
 * Elements types — ported from CineGen src/types/elements.ts
 */

export const ELEMENT_TYPES = ['character', 'location', 'prop', 'vehicle'];

export const ElementType = {
  CHARACTER: 'character',
  LOCATION: 'location',
  PROP: 'prop',
  VEHICLE: 'vehicle',
};

export function createElementImage(params) {
  return {
    id: params.id || crypto.randomUUID(),
    url: params.url,
    createdAt: params.createdAt || new Date().toISOString(),
    source: params.source || 'generated',
  };
}

export function createElement(params) {
  return {
    id: params.id || crypto.randomUUID(),
    name: params.name,
    type: params.type,
    description: params.description || '',
    images: params.images || [],
    createdAt: params.createdAt || new Date().toISOString(),
    updatedAt: params.updatedAt || new Date().toISOString(),
  };
}
