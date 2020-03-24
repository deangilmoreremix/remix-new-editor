import React, { useEffect, useRef, useState } from 'react';

import Rotate from '../../lib/utils/rotate';
import PropTypes from '../../lib/PropTypes';

import FormTextField from './FormTextField';

const stylesSizes = {
  paddingLeft: 10,
  charWidth: 9,
};

const FormAngle = ({ name, onChange, value = 0 }) => {
  const [angle, setAngle] = useState(value);
  const [formAngle, setFormAngle] = useState();
  const rotateRef = useRef();

  useEffect(() => {
    const item = new Rotate(rotateRef.current, angle, setAngle);
    item.start();
    setFormAngle(item);
    return () => {
      item.delete();
    };
  }, []);

  useEffect(() => {
    onChange(angle);
  }, [angle, onChange]);

  const onInputChange = (angleValue) => {
    if (angleValue > 360) {
      angleValue = 360;
    } else if (angleValue < 0) {
      angleValue = 0;
    }

    formAngle.delete();
    const item = new Rotate(rotateRef.current, Number(angleValue), setAngle);
    item.start();
    setFormAngle(item);
    setAngle(Number(angleValue));
  };

  return (
    <div className="form-angle">
      <div className="angle-circle">
        <span className="angle-circle__line" ref={rotateRef} />
      </div>
      <div className="form-angle__input">
        <FormTextField
          type="number"
          name={name}
          onChange={onInputChange}
          value={angle}
        />
        <span
          className="form-angle__input-degree"
          style={{ left: `${String(angle).length * stylesSizes.charWidth + stylesSizes.paddingLeft}px` }}
        >
          &#176;
        </span>
      </div>
    </div>
  );
};

FormAngle.propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.number,
};

export default FormAngle;
