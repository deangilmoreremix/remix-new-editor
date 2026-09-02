import isEmpty from 'lodash/isEmpty';

export const isLayerFulfilled = ({ start, end }, elements) => elements
  .some(({ popcornOptions: { start: itemStart, end: itemEnd } }) => !(((itemEnd >= end)
  && (itemStart >= end)) || ((itemStart <= start) && (itemEnd <= start))));

export const validateBeforeSave = (item) => {
  const errors = {};

  if (!item.title) {
    errors.title = true;
  }

  return !isEmpty(errors) ? errors : false;
};
