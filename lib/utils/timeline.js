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

export const getTransitionButtons = (item, index, elements) => {
  const buttons = [];

  if (item.type === SEQUENCER) {
    const items = elements.filter(e => e.type === SEQUENCER && e.i !== item.i);

    if (items.length) {
      const track = item.layer;
      const transitionWithOffset = TRANSITION_TIMELINE_OFFSET + TRANSITION_DEFAULT_DURATION;

      items.forEach(el => {
        const transitionSize = getTransitionSize(item, el);
        if (item.y === el.y && transitionSize) {
          if (
            item.x < el.x
            && Math.abs(
              (el.x - (item.x + item.w)) / SANTISECOND,
            ) < TRANSITION_APPEARING_INTERVAL
          ) {
            const transition = {
              from: item.i,
              to: el.i,
              start: (item.x + item.w) / SANTISECOND + TRANSITION_TIMELINE_OFFSET,
              end: el.x / SANTISECOND + transitionWithOffset,
              track,
              ...transitionSize,
            };
            const element = {
              id: el.i,
              start: (el.x / SANTISECOND) + transitionWithOffset + TRANSITION_TIMELINE_OFFSET,
              end: (el.x + el.w) / SANTISECOND + transitionWithOffset,
            };
            const type = FROM;
            const key = `${item.i}-to-${el.i}`;
            buttons.push({
              transition,
              element,
              type,
              key,
              from: item.i,
              to: el.i,
            });
          }
          if (
            el.x < item.x
            && Math.abs(
              (item.x - (el.x + el.w)) / SANTISECOND,
            ) < TRANSITION_APPEARING_INTERVAL
          ) {
            const transition = {
              from: el.i,
              to: item.i,
              start: (el.x + el.w) / SANTISECOND + TRANSITION_TIMELINE_OFFSET,
              end: item.x / SANTISECOND + transitionWithOffset,
              track,
              ...transitionSize,
            };
            const element = {
              id: item.i,
              start: (item.x / SANTISECOND) + transitionWithOffset + TRANSITION_TIMELINE_OFFSET,
              end: (item.x + item.w) / SANTISECOND + transitionWithOffset,
            };
            const type = TO;
            const key = `${el.i}-to-${item.i}`;
            buttons.push({
              transition,
              element,
              type,
              key,
              from: el.i,
              to: item.i,
            });
          }
        }
      });
    }
  }
  return buttons;
};
