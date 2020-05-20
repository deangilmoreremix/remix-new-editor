import { FROM, SEQUENCER, TO } from '../constants/popcorn';
import { SANTISECOND } from '../constants/project';
import {
  TRANSITION_APPEARING_INTERVAL,
  TRANSITION_DEFAULT_DURATION,
  TRANSITION_TIMELINE_OFFSET,
} from '../constants/settings/video-transition';

export const getTransitionButtons = (item, index, items) => {
  const buttons = [];
  const track = item.layer;

  const nextEl = items[index + 1];
  const prevEl = items[index - 1];

  const transitionWithOffset = TRANSITION_TIMELINE_OFFSET + TRANSITION_DEFAULT_DURATION;

  // if the current element is earlier than the next element
  if (
    item.type === SEQUENCER
    && nextEl
    && nextEl.type === SEQUENCER
    && item.y === nextEl.y
    && item.x < nextEl.x
    && Math.abs((nextEl.x - (item.x + item.w)) / SANTISECOND) < TRANSITION_APPEARING_INTERVAL
  ) {
    const transition = {
      from: item.i,
      to: nextEl.i,
      start: (item.x + item.w) / SANTISECOND + TRANSITION_TIMELINE_OFFSET,
      end: nextEl.x / SANTISECOND + transitionWithOffset,
      track,
    };
    const element = {
      id: nextEl.i,
      start: (nextEl.x / SANTISECOND) + transitionWithOffset,
      end: (nextEl.x + nextEl.w) / SANTISECOND + transitionWithOffset,
    };
    const type = FROM;
    const key = `${item.i}-to-${nextEl.i}`;
    buttons.push({
      transition,
      element,
      type,
      key,
      pair: {
        from: item.i,
        to: nextEl.i,
      },
    });
  }

  // if the current element is earlier than the previous element
  if (
    item.type === SEQUENCER
    && prevEl
    && prevEl.type === SEQUENCER
    && item.y === prevEl.y
    && item.x < prevEl.x
    && Math.abs((prevEl.x - (item.x + item.w)) / SANTISECOND) < TRANSITION_APPEARING_INTERVAL
  ) {
    const transition = {
      from: item.i,
      to: prevEl.i,
      start: (item.x + item.w) / SANTISECOND + TRANSITION_TIMELINE_OFFSET,
      end: prevEl.x / SANTISECOND + transitionWithOffset,
      track,
    };
    const element = {
      id: prevEl.i,
      start: (prevEl.x / SANTISECOND) + transitionWithOffset,
      end: (prevEl.x + prevEl.w) / SANTISECOND + transitionWithOffset,
    };
    const type = FROM;
    const key = `${item.i}-to-${prevEl.i}`;
    buttons.push({
      transition,
      element,
      type,
      key,
      pair: {
        from: item.i,
        to: prevEl.i,
      },
    });
  }

  // if the next element is earlier than the current element
  if (
    item.type === SEQUENCER
    && nextEl
    && nextEl.type === SEQUENCER
    && item.y === nextEl.y
    && nextEl.x < item.x
    && Math.abs((item.x - (nextEl.x + nextEl.w)) / SANTISECOND) < TRANSITION_APPEARING_INTERVAL
  ) {
    const transition = {
      from: nextEl.i,
      to: item.i,
      start: (nextEl.x + nextEl.w) / SANTISECOND + TRANSITION_TIMELINE_OFFSET,
      end: item.x / SANTISECOND + transitionWithOffset,
      track,
    };
    const element = {
      id: item.i,
      start: (item.x / SANTISECOND) + transitionWithOffset,
      end: (item.x + item.w) / SANTISECOND + transitionWithOffset,
    };
    const type = TO;
    const key = `${nextEl.i}-to-${item.i}`;
    buttons.push({
      transition,
      element,
      type,
      key,
      pair: {
        from: nextEl.i,
        to: item.i,
      },
    });
  }

  // if the previous element is earlier than the next element
  if (
    item.type === SEQUENCER
    && prevEl
    && prevEl.type === SEQUENCER
    && item.y === prevEl.y
    && prevEl.x < item.x
    && Math.abs((item.x - (prevEl.x + prevEl.w)) / SANTISECOND) < TRANSITION_APPEARING_INTERVAL
  ) {
    const transition = {
      from: prevEl.i,
      to: item.i,
      start: (prevEl.x + prevEl.w) / SANTISECOND + TRANSITION_TIMELINE_OFFSET,
      end: item.x / SANTISECOND + transitionWithOffset,
      track,
    };
    const element = {
      id: item.i,
      start: (item.x / SANTISECOND) + transitionWithOffset,
      end: (item.x + item.w) / SANTISECOND + transitionWithOffset,
    };
    const type = TO;
    const key = `${prevEl.i}-to-${item.i}`;
    buttons.push({
      transition,
      element,
      type,
      key,
      pair: {
        from: prevEl.i,
        to: item.i,
      },
    });
  }

  return buttons;
};
