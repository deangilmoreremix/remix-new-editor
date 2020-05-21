/* eslint-disable no-underscore-dangle */

import { FROM, SEQUENCER, TO } from '../constants/popcorn';
import { SANTISECOND } from '../constants/project';
import {
  TRANSITION_APPEARING_INTERVAL,
  TRANSITION_DEFAULT_DURATION,
  TRANSITION_TIMELINE_OFFSET,
} from '../constants/settings/video-transition';

const roundTo2Decimals = num => Math.round((num + Number.EPSILON) * 100) / 100;

const getTransitionSize = (el1 = {}, el2 = {}) => {
  const { dimensions: size1 } = el1;
  const { dimensions: size2 } = el2;
  const { width: w1, height: h1 } = size1 || {};
  const { width: w2, height: h2 } = size2 || {};

  if (
    (w1 && h1)
    && (w2 && h2)
    && (roundTo2Decimals(w1 / h1) === roundTo2Decimals(w2 / h2))
  ) {
    return Math.max(w1, w2) === w1
      ? {
        width: w1,
        height: h1,
      }
      : {
        width: w2,
        height: h2,
      };
  }
  return undefined;
};

export const getTransitionButtons = (item, index, items) => {
  const buttons = [];
  const track = item.layer;

  const nextEl = items[index + 1];
  const prevEl = items[index - 1];

  const itemToNext = getTransitionSize(item, nextEl);
  const itemToPrev = getTransitionSize(item, prevEl);

  const transitionWithOffset = TRANSITION_TIMELINE_OFFSET + TRANSITION_DEFAULT_DURATION;
  // if next element exists
  if (
    item.type === SEQUENCER
    && item.dimensions
    && nextEl
    && nextEl.type === SEQUENCER
    && nextEl.dimensions
    && itemToNext
    && item.y === nextEl.y) {
    // if the current element is earlier than the next element
    if (
      item.x < nextEl.x
      && Math.abs((nextEl.x - (item.x + item.w)) / SANTISECOND) < TRANSITION_APPEARING_INTERVAL
    ) {
      const transition = {
        from: item.i,
        to: nextEl.i,
        start: (item.x + item.w) / SANTISECOND + TRANSITION_TIMELINE_OFFSET,
        end: nextEl.x / SANTISECOND + transitionWithOffset,
        track,
        ...itemToNext,
      };
      const element = {
        id: nextEl.i,
        start: (nextEl.x / SANTISECOND) + transitionWithOffset + TRANSITION_TIMELINE_OFFSET,
        end: (nextEl.x + nextEl.w) / SANTISECOND + transitionWithOffset,
      };
      const type = FROM;
      const key = `${item.i}-to-${nextEl.i}`;
      buttons.push({
        transition,
        element,
        type,
        key,
        from: item.i,
        to: nextEl.i,
      });
    }

    // if the next element is earlier than the current element
    if (
      nextEl.x < item.x
      && Math.abs((item.x - (nextEl.x + nextEl.w)) / SANTISECOND) < TRANSITION_APPEARING_INTERVAL
    ) {
      const transition = {
        from: nextEl.i,
        to: item.i,
        start: (nextEl.x + nextEl.w) / SANTISECOND + TRANSITION_TIMELINE_OFFSET,
        end: item.x / SANTISECOND + transitionWithOffset,
        track,
        ...itemToNext,
      };
      const element = {
        id: item.i,
        start: (item.x / SANTISECOND) + transitionWithOffset + TRANSITION_TIMELINE_OFFSET,
        end: (item.x + item.w) / SANTISECOND + transitionWithOffset,
      };
      const type = TO;
      const key = `${nextEl.i}-to-${item.i}`;
      buttons.push({
        transition,
        element,
        type,
        key,
        from: nextEl.i,
        to: item.i,
      });
    }
  }

  // if previous element exists
  if (
    item.type === SEQUENCER
    && item.dimensions
    && prevEl
    && prevEl.type === SEQUENCER
    && prevEl.dimensions
    && itemToPrev
    && item.y === prevEl.y
  ) {
    // if the current element is earlier than the previous element
    if (
      item.x < prevEl.x
      && Math.abs((prevEl.x - (item.x + item.w)) / SANTISECOND) < TRANSITION_APPEARING_INTERVAL
    ) {
      const transition = {
        from: item.i,
        to: prevEl.i,
        start: (item.x + item.w) / SANTISECOND + TRANSITION_TIMELINE_OFFSET,
        end: prevEl.x / SANTISECOND + transitionWithOffset,
        track,
        ...itemToPrev,
      };
      const element = {
        id: prevEl.i,
        start: (prevEl.x / SANTISECOND) + transitionWithOffset + TRANSITION_TIMELINE_OFFSET,
        end: (prevEl.x + prevEl.w) / SANTISECOND + transitionWithOffset,
      };
      const type = FROM;
      const key = `${item.i}-to-${prevEl.i}`;
      buttons.push({
        transition,
        element,
        type,
        key,
        from: item.i,
        to: prevEl.i,
      });
    }

    // if the previous element is earlier than the next element
    if (
      prevEl.x < item.x
      && Math.abs((item.x - (prevEl.x + prevEl.w)) / SANTISECOND) < TRANSITION_APPEARING_INTERVAL
    ) {
      const transition = {
        from: prevEl.i,
        to: item.i,
        start: (prevEl.x + prevEl.w) / SANTISECOND + TRANSITION_TIMELINE_OFFSET,
        end: item.x / SANTISECOND + transitionWithOffset,
        track,
        ...itemToPrev,
      };
      const element = {
        id: item.i,
        start: (item.x / SANTISECOND) + transitionWithOffset + TRANSITION_TIMELINE_OFFSET,
        end: (item.x + item.w) / SANTISECOND + transitionWithOffset,
      };
      const type = TO;
      const key = `${prevEl.i}-to-${item.i}`;
      buttons.push({
        transition,
        element,
        type,
        key,
        from: prevEl.i,
        to: item.i,
      });
    }
  }

  return buttons;
};
