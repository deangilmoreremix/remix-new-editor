// [remix] Window events that let the empty-project start screen (and other places) ask the editor to do something that lives in another
// component, without passing props through the whole editor (keeps CineGen's own files close to upstream).
/** Open the media import (file picker) of the left panel. Handled by left-panel.tsx. */
export const IMPORT_MEDIA_EVENT = 'cinegen:import-media';
/** Open the Template Generator wizard. Handled by timeline-editor.tsx. */
export const OPEN_GENERATOR_EVENT = 'cinegen:open-generator';
