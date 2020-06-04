import React, { useEffect, useRef, useState } from 'react';
import interact from 'interactjs';
import moment from 'moment';

import PropTypes from '../../lib/PropTypes';

import { TIME_DISPLAY_FORMAT } from '../../lib/constants/formats';

const DEFAULT_TIME_VALUE = '0:00:00';

const LineDuration = ({ duration, from, to, changeFrom, changeOut, changeFromOut }) => {
  const refSlider = useRef();

  const [slider, setSlider] = useState();
  const [initialStart, setInitialStart] = useState(0); // in %
  const [initialWidth, setInitialWidth] = useState(0); // in %

  const [secondsFrom, setSecondsFrom] = useState();
  const [secondsTo, setSecondsTo] = useState();

  useEffect(() => {
    setSlider(interact(refSlider.current));
  }, []);

  useEffect(() => {
    const parentWidth = refSlider.current.parentNode.offsetWidth;
    const parentFrom = +from.toFixed(2);
    const parentTo = +to.toFixed(2);

    if (parentFrom !== secondsFrom) {
      setInitialStart((((parentWidth / (duration || 1))
        * parentFrom) / parentWidth) * 100);
      setSecondsFrom(parentFrom);
    }

    if (parentTo !== secondsTo) {
      setInitialWidth((((parentWidth / (duration || 1))
        * (parentTo - parentFrom)) / parentWidth) * 100);
      setSecondsTo(parentTo);
    }
  }, [from, to]);

  const changePosition = (event) => {
    const parentWidth = refSlider.current.parentNode.offsetWidth; // in %
    const { target } = event;

    const leftButton = target.style.left.replace(/%/g, ''); // position in %
    const rightButton = (parseFloat(target.style.left.replace(/%/g, '')) + (parseFloat(target.offsetWidth) / parentWidth) * 100); // position in %

    let xLeft = ((parentWidth * leftButton) / 100) || 0;
    xLeft += event.deltaRect.left;
    let xRight = ((parentWidth * rightButton) / 100) || 0;
    xRight += event.deltaRect.left;

    let relativeLeft = (xLeft / parentWidth) * 100; // new position left btn in %
    let relativeRight = (xRight / parentWidth) * 100; // new position right btn in %
    if (relativeLeft < 0) {
      relativeLeft = 0;
    }

    if (relativeRight > 100) {
      relativeRight = 100;
    }

    const newSecondsFrom = +(relativeLeft
      / (((parentWidth / duration) / parentWidth) * 100))
      .toFixed(2); // new position left btn in seconds
    const newSecondsTo = +(relativeRight
      / (((parentWidth / duration) / parentWidth) * 100))
      .toFixed(2); // new position right btn in seconds

    if (from !== newSecondsFrom) {
      setSecondsFrom(newSecondsFrom);
      changeFrom({ from: newSecondsFrom });
      return;
    }

    if (to !== newSecondsTo) {
      setSecondsTo(newSecondsTo);
      changeOut({ out: newSecondsTo });
    }
  };

  const dragPosition = event => {
    const { target } = event;
    const parentWidth = refSlider.current.parentNode.offsetWidth;
    const leftButton = target.style.left.replace(/%/g, '');
    const rightButton = (parseFloat(target.style.left.replace(/%/g, ''))
      + (parseFloat(target.offsetWidth) / parentWidth) * 100); // position in %

    const xLeft = ((parentWidth * leftButton) / 100) || 0 + event.dx;
    const xRight = ((parentWidth * rightButton) / 100) || 0 + event.dx;

    let relativeLeft = (xLeft / parentWidth) * 100;
    let relativeRight = (xRight / parentWidth) * 100; // new position right btn in %

    if (relativeLeft < 0) {
      relativeLeft = 0;
    }

    if (relativeRight > 100) {
      relativeRight = 100;
    }

    const newSecondsFrom = +(relativeLeft
      / (((parentWidth / duration) / parentWidth) * 100))
      .toFixed(2); // new position left btn in seconds
    const newSecondsTo = +(relativeRight
      / (((parentWidth / duration) / parentWidth) * 100))
      .toFixed(2); // new position right btn in seconds

    setSecondsFrom(newSecondsFrom);
    setSecondsTo(newSecondsTo);
    changeFromOut({ from: newSecondsFrom });
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
        inertia: true,
      })
      .draggable({
        listeners: {
          move: dragMoveListener,
          end: dragPosition,
        },
        inertia: true,
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
        <div className="line-duration-slider" ref={refSlider} style={{ left: `${initialStart}%`, width: `${initialWidth}%` }}>
          <div className="line-duration__toggle line-duration__toggle--left" />
          <div className="line-duration__toggle line-duration__toggle--right" />
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
  changeFromOut: PropTypes.func.isRequired,
};

export default LineDuration;
