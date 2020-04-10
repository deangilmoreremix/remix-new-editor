export const isLayerFulfilled = ({ start, end }, elements) => elements
  .some(({ popcornOptions: { start: itemStart, end: itemEnd } }) => !(((itemEnd >= end)
  && (itemStart >= end)) || ((itemStart <= start) && (itemEnd <= start))));
