export default ({
  time,
  startDateWithZoom,
  startDate,
  endDateWithZoom,
  isPlayed,
  timelineSideRef,
  sortableWidth,
}) => {
  if ((time * 10 < startDateWithZoom.diff(startDate)
    || time * 10 > endDateWithZoom.diff(startDate))
    && !isPlayed) {
    return { display: 'none' };
  }

  const layerWidth = timelineSideRef.current.getBoundingClientRect().width;
  const timeDuration = endDateWithZoom.diff(startDateWithZoom);
  const msInPx = layerWidth / timeDuration;
  const left = ((msInPx * (time * 10 - (startDateWithZoom.diff(startDate))))) + sortableWidth;
  return { left };
};
