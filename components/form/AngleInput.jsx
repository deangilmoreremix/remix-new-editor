import React from 'react';

import PropTypes from '../../lib/PropTypes';

import AngleCircle from './AngleCircle';
import FormTextField from './FormTextField';

const stylesSizes = {
  paddingLeft: 10,
  charWidth: 9,
};

const AngleInput = ({ name, onChange, value = 0 }) => {
  const onInputChange = (angleValue) => {
    if (angleValue > 360) {
      angleValue = 0;
    }
    if (angleValue < 0) {
      angleValue = 360;
    }

    onChange(Number(angleValue));
  };

  return (
    <div className="form-angle">
      <AngleCircle onChange={onChange} value={value} />
      <div className="form-angle__input">
        <FormTextField
          type="number"
          name={name}
          onChange={onInputChange}
          value={value}
        />
        <span
          className="form-angle__degree"
          style={{ left: `${String(value).length * stylesSizes.charWidth + stylesSizes.paddingLeft}px` }}
        >
          &#176;
        </span>
      </div>
    </div>
  );
};

AngleInput.propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.number.isRequired,
};

export default AngleInput;
