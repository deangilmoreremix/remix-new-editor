import * as React from 'react';
import classnames from 'classnames';
import { Input, InputLabel, Slider } from '@material-ui/core';

import PropTypes from '../../lib/PropTypes';

const FormSliderVertical = ({
  containerClassName,
  inputClassName,
  sliderClassName,
  labelClassName,
  label,
  disabled,
  minValue,
  maxValue,
  onChange,
  value,
}) => {
  const handleSliderChange = (event, newValue) => {
    onChange(newValue);
  };

  const handleInputChange = event => {
    const { value: val } = event.target;
    if (val && !Number.isNaN(val)) {
      onChange(parseInt(val, 10));
    } else {
      onChange('');
    }
  };

  const handleBlur = () => {
    if (!value || value < minValue) {
      onChange(minValue);
    } else if (value > maxValue) {
      onChange(maxValue);
    }
  };

  return (
    <div className={classnames('slider-element', 'vertical-slider', containerClassName)}>
      <InputLabel className={classnames(labelClassName, 'vertical-input-label')}>
        {label}
      </InputLabel>
      <Slider
        className={classnames('vertical-slider-range', sliderClassName)}
        orientation="vertical"
        defaultValue={30}
        aria-labelledby="vertical-slider"
        onChange={handleSliderChange}
        onBlur={handleBlur}
      />
      <Input
        className={classnames('vertical-slider-input', 'slider-input', inputClassName)}
        value={value}
        disabled={disabled}
        onChange={handleInputChange}
        onBlur={handleBlur}
        inputProps={{
          min: minValue,
          max: maxValue,
          type: 'number',
          'aria-labelledby': 'input-slider',
        }}
      />
    </div>
  );
};

FormSliderVertical.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.number,
  containerClassName: PropTypes.string,
  inputClassName: PropTypes.string,
  sliderClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  label: PropTypes.string,
  disabled: PropTypes.bool,
  minValue: PropTypes.number,
  maxValue: PropTypes.number,
};

export default FormSliderVertical;
