import { SEQUENCER } from '../constants/popcorn';
import { SANTISECOND } from '../constants/project';
import {
  TRANSITION_APPEARING_INTERVAL,
  TRANSITION_DEFAULT_DURATION,
  TRANSITION_TIMELINE_OFFSET,
} from '../constants/settings/video-transition';

export const checkTransitionAvailable = (item, index, items) => {
  let transition = null;
  let element = null;

  const nextEl = items[index + 1];
  const prevEl = items[index - 1];

  if (
    item.type === SEQUENCER
    && nextEl
    && nextEl.type === SEQUENCER
    && item.y === nextEl.y
    && item.x < nextEl.x
    && (nextEl.x - (item.x + item.w)) / SANTISECOND < TRANSITION_APPEARING_INTERVAL
  ) {
    const transitionWithOffset = TRANSITION_TIMELINE_OFFSET + TRANSITION_DEFAULT_DURATION;
    transition = {
      from: item.i,
      to: nextEl.i,
      start: (item.x + item.w) / SANTISECOND + TRANSITION_TIMELINE_OFFSET,
      end: nextEl.x / SANTISECOND + transitionWithOffset,
    };
    element = {
      id: nextEl.i,
      start: (nextEl.x / SANTISECOND) + transitionWithOffset,
      end: (nextEl.x + nextEl.w) / SANTISECOND + transitionWithOffset,
    };
  } else if (
    item.type === SEQUENCER
    && prevEl
    && prevEl.type === SEQUENCER
    && item.y === prevEl.y
    && prevEl.x < item.x
    && (item.x - (prevEl.x + prevEl.w)) / SANTISECOND < TRANSITION_APPEARING_INTERVAL
  ) {
    const transitionWithOffset = TRANSITION_TIMELINE_OFFSET + TRANSITION_DEFAULT_DURATION;
    transition = {
      from: prevEl.i,
      to: item.i,
      start: (prevEl.x + prevEl.w) / SANTISECOND + TRANSITION_TIMELINE_OFFSET,
      end: item.x / SANTISECOND + transitionWithOffset,
    };
    element = {
      id: item.i,
      start: (item.x / SANTISECOND) + transitionWithOffset,
      end: (item.x + item.w) / SANTISECOND + transitionWithOffset,
    };
  }

  if (transition && element) {
    return { transition, element };
  }
  return null;
};
