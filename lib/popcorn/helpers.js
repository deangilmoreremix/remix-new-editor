export const getNativeOptions = (popcornElement) =>
  popcornElement &&
  popcornElement._natives &&
  popcornElement._natives.manifest
    ? popcornElement._natives.manifest.options
    : [];
