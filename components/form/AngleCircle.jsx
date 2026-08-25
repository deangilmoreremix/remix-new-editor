import React, { useRef, useEffect } from 'react';

import PropTypes from '../../lib/PropTypes';

const AngleInput = ({ value, onChange }) => {
  const circleRef = useRef(null);
  const leverRef = useRef(null);

  useEffect(() => () => {
    leverRef.current.removeEventListener('mousedown', start);
    document.removeEventListener('mouseup', stop);
    document.removeEventListener('mousemove', getAngle);
  }, []);

  useEffect(() => {
    circleRef.current.style.transform = `rotate(${value}deg)`;
  }, [value]);

  const start = () => {
    document.addEventListener('mouseup', stop);
    document.addEventListener('mousemove', getAngle);
  };

  const stop = () => {
    document.removeEventListener('mousemove', getAngle);
    document.removeEventListener('mouseup', stop);
  };

  const getAngle = (e) => {
    if (circleRef.current.getBoundingClientRect()) {
      const rect = circleRef.current.getBoundingClientRect();
      const cx = window.pageXOffset + rect.left + rect.width / 2;
      const cy = window.pageYOffset + rect.top + rect.height / 2;

      const dy = e.pageY - cy;
      const dx = e.pageX - cx;
      let theta = Math.atan2(dy, dx);
      theta *= 180 / Math.PI;

      if (theta < 0) {
        theta = 360 + theta;
      }
      const deg = (theta + 90) % 360;
      circleRef.current.style.transform = `rotate(${deg}deg)`;
      onChange(Math.round(deg));
    }
  };

  return (
    <div className="angle-circle" ref={circleRef}>
      <button
        type="button"
        className="angle-circle__line"
        ref={leverRef}
        onMouseDown={start}
      />
    </div>
  );
};

AngleInput.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default AngleInput;
