import moment from 'moment';
import { DEFAULT_DURATION } from '../constants/project';

export const dropItemOnTimeline = ({
  monitor,
  timelineRowHeight,
  sortableWidth,
  startDateWithZoom,
  startDate,
  endDateWithZoom,
  layers,
  projectData,
}) => {
  const dragBlock = document.querySelector('.timeline-container');
  const { top, width } = dragBlock.getBoundingClientRect();
  const { x, y } = monitor.getClientOffset();
  const topPositionItem = (y - top);
  const rowOrderInDrag = Math.floor(topPositionItem / timelineRowHeight);
  const trackInDrag = layers.find(layer => layer.order === rowOrderInDrag);

  const currentPosition = x - sortableWidth;
  const msWidth = width / endDateWithZoom.diff(startDateWithZoom);
  const currentTime = startDateWithZoom.diff(startDate) + currentPosition / msWidth;
  let startInDrag = +moment.duration(currentTime).asSeconds() - (DEFAULT_DURATION / 2);
  let endInDrag = null;

  projectData.media.forEach(media => {
    media.tracks.forEach(track => {
      if (track.id === trackInDrag.id) {
        track.trackEvents.forEach(trackEvent => {
          const { start, end } = trackEvent.popcornOptions;
          if (startInDrag > start && startInDrag < end) {
            startInDrag = end + 0.01;
          }

          if (startInDrag + DEFAULT_DURATION < end && startInDrag + DEFAULT_DURATION > start) {
            endInDrag = start - 0.01;
          }
        });
      }
    });
  });

  if (startInDrag < 0) {
    startInDrag = 0;
  }

  if (!endInDrag) {
    endInDrag = startInDrag + DEFAULT_DURATION;
  }

  if (endInDrag < startInDrag + 1) {
    endInDrag = startInDrag + DEFAULT_DURATION;
  }

  return { startInDrag, endInDrag, trackInDrag };
};
