import React, { useEffect, useRef, useState } from 'react';
import Rotate from '../../lib/utils/rotate';

import PropTypes from '../../lib/PropTypes';
import FormTextField from './FormTextField';

const FormAngle = ({ name, onChange, value = 0 }) => {
  const [angle, setAngle] = useState(value);
  const [formAngle, setFormAngle] = useState();
  const handleRotate = useRef();

  useEffect(() => {
    const item = new Rotate(handleRotate.current, angle, setAngle);
    item.start();
    setFormAngle(item);
    return () => {
      item.delete();
    };
  }, [angle]);

  useEffect(() => {
    if (onChange) {
      onChange(angle);
    }
  }, [angle, onChange]);

  const onInputChange = (angleValue) => {
    let newValue = parseFloat(angleValue);
    if (angleValue > 360) {
      newValue = 360;
    } else if (value < 0) {
      newValue = 0;
    }

    formAngle.delete();
    const item = new Rotate(handleRotate.current, newValue, setAngle);
    item.start();
    setFormAngle(item);
    setAngle(newValue);
  };

  return (
    <div className="form-angle">
      <div className="angle-circle">
        <span className="angle-circle__line" ref={handleRotate} />
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
          style={{ left: `${String(angle).length * 9 + 10}px` }}
        >
          &#176;
        </span>
      </div>
    </div>
  );
};

FormAngle.propTypes = {
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.numbers,
};

export default FormAngle;
