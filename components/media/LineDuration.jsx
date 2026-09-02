import React, { useEffect, useRef, useState } from 'react';
import interact from 'interactjs';
import moment from 'moment';
import { useWindowSize } from '@react-hook/window-size';

import PropTypes from '../../lib/PropTypes';

import { TIME_DISPLAY_FORMAT } from '../../lib/constants/formats';

const DEFAULT_TIME_VALUE = '0:00:00';

const LineDuration = ({ duration, from, to, changeFrom, changeOut, updateFrom }) => {
  const refSlider = useRef();

  const [slider, setSlider] = useState();
  const [initialStart, setInitialStart] = useState(0); // in %
  const [initialWidth, setInitialWidth] = useState(0); // in %

  const [secondsFrom, setSecondsFrom] = useState();
  const [secondsTo, setSecondsTo] = useState();

  const [windowWidth] = useWindowSize();

  useEffect(() => {
    setSlider(interact(refSlider.current));
  }, []);

  useEffect(() => {
    const parentWidth = refSlider.current.parentNode.offsetWidth;
    const parentFrom = +from.toFixed(2);
    const parentTo = +to.toFixed(2);

    const newWidthInPercents = ((((parentWidth / (duration || 1))
      * (parentTo - parentFrom)) / parentWidth) * 100).toFixed(2);
    setInitialWidth(newWidthInPercents);

    if (parentFrom !== secondsFrom) {
      const newStartInPercents = ((((parentWidth / (duration || 1)) * parentFrom)
        / parentWidth) * 100).toFixed(2);
      setInitialStart(newStartInPercents);
      setSecondsFrom(parentFrom);
    }

    if (parentTo !== secondsTo) {
      setSecondsTo(parentTo);
    }
  }, [from, to, windowWidth]);

  const changePosition = (event) => {
    const { target } = event;
    const parentWidth = refSlider.current.parentNode.offsetWidth; // in px
    const leftButton = target.style.left.replace(/%/g, ''); // position in %
    const rightButton = parseFloat(target.style.left.replace(/%/g, '')) + (parseFloat(target.offsetWidth) / parentWidth) * 100; // position in %

    const xLeft = ((parentWidth * leftButton) / 100) || 0;
    const xRight = ((parentWidth * rightButton) / 100) || 0;

    let relativeLeft = (xLeft / parentWidth) * 100; // new position left btn in %
    let relativeRight = (xRight / parentWidth) * 100; // new position right btn in %
    if (relativeLeft < 0) {
      relativeLeft = 0;
    }

    if (relativeRight > 100) {
      relativeRight = 100;
    }

    let newSecondsFrom = +(relativeLeft
      / (((parentWidth / duration) / parentWidth) * 100))
      .toFixed(2); // new position left btn in seconds
    let newSecondsTo = +(relativeRight
      / (((parentWidth / duration) / parentWidth) * 100))
      .toFixed(2); // new position right btn in seconds

    if (newSecondsFrom < 0) {
      newSecondsFrom = 0;
    }

    if (newSecondsTo > duration) {
      newSecondsTo = duration;
    }

    if (+from.toFixed(2) !== newSecondsFrom) {
      changeFrom({ from: newSecondsFrom });
      return;
    }

    if (+to.toFixed(2) !== newSecondsTo) {
      changeOut({ out: newSecondsTo });
    }
  };

  const dragPosition = event => {
    const { target } = event;
    const parentWidth = refSlider.current.parentNode.offsetWidth;
    const leftButton = target.style.left.replace(/%/g, '');
    const xLeft = ((parentWidth * leftButton) / 100) || 0 + event.dx;
    let relativeLeft = (xLeft / parentWidth) * 100;

    if (relativeLeft < 0) {
      relativeLeft = 0;
    }

    const newSecondsFrom = +(relativeLeft
      / (((parentWidth / duration) / parentWidth) * 100))
      .toFixed(2); // new position left btn in seconds

    updateFrom({ from: newSecondsFrom });
  };

  const dragMoveListener = event => {
    const { target } = event;
    const parentWidth = refSlider.current.parentNode.offsetWidth;
    const currentLeft = target.style.left.replace(/%/g, '');

    const x = (((parentWidth * currentLeft) / 100) || 0) + event.dx;
    const relativeLeft = (x / parentWidth) * 100;

    target.style.left = `${relativeLeft}%`;
  };

  const resizeListener = event => {
    const parentWidth = refSlider.current.parentNode.offsetWidth;
    const { target } = event;
    const currentLeft = target.style.left.replace(/%/g, '');

    let x = ((parentWidth * currentLeft) / 100) || 0;
    target.style.width = `${(event.rect.width / parentWidth) * 100}%`;
    x += event.deltaRect.left;

    const relativeLeft = (x / parentWidth) * 100;
    target.style.left = `${relativeLeft}%`;
  };

  if (slider) {
    slider
      .resizable({
        edges: {
          left: true,
          right: true,
          bottom: false,
          top: false,
        },

        listeners: {
          move: resizeListener,
          end: changePosition,
        },
        modifiers: [
          interact.modifiers.restrictEdges({
            outer: 'parent',
          }),
          interact.modifiers.restrictSize({
            min: {
              width: 1,
              height: 35,
            },
          }),
        ],
        inertia: false,
      })
      .draggable({
        listeners: {
          move: dragMoveListener,
          end: dragPosition,
        },
        inertia: false,
        modifiers: [
          interact.modifiers.restrictRect({
            restriction: 'parent',
            endOnly: true,
          }),
        ],
      });
  }

  const formattedValue = seconds => {
    if (!seconds) {
      return DEFAULT_TIME_VALUE;
    }

    const time = moment.duration({ seconds });
    return moment({ minutes: 0, seconds: 0 }).add(time).format(TIME_DISPLAY_FORMAT);
  };

  return (
    <div>
      <div className="line-duration-block">
        <p className="line-duration-time">0:00</p>
        <p className="line-duration-time">{formattedValue(duration)}</p>
      </div>
      <div className="line-duration">
        <div className="line-duration__inner">
          <div className="line-duration-slider" ref={refSlider} style={{ left: `${initialStart}%`, width: `${initialWidth}%` }}>
            <div className="line-duration__toggle line-duration__toggle--left" />
            <div className="line-duration__toggle line-duration__toggle--right" />
          </div>
        </div>
      </div>
    </div>
  );
};

LineDuration.propTypes = {
  duration: PropTypes.number.isRequired,
  from: PropTypes.number.isRequired,
  to: PropTypes.number.isRequired,
  changeFrom: PropTypes.func.isRequired,
  changeOut: PropTypes.func.isRequired,
  updateFrom: PropTypes.func.isRequired,
};

export default LineDuration;
