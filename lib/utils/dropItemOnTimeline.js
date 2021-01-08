import moment from 'moment';
import { DEFAULT_DURATION } from '../constants/project';

export const dropItemOnTimeline = ({
  monitor, timelineRowHeight, sortableWidth, startDateWithZoom, startDate, endDateWithZoom, layers,
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

  if (startInDrag < 0) {
    startInDrag = 0;
  }

  return { startInDrag, trackInDrag };
};
