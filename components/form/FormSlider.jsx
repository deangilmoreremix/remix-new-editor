import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Slider from '@material-ui/core/Slider';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const FormSlider = props => {
  const {
    value,
    onChange,
    label,
    sliderWidth,
    withoutInput,
    inputWidth,
    minValue,
    maxValue,
    containerClass,
    sliderClass,
    inputClass,
    disabled,
  } = props;

  const useStyles = makeStyles({
    root: {
      width: sliderWidth,
    },
    input: {
      width: inputWidth,
    },
  });
  const classes = useStyles(sliderWidth, inputWidth);

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
    <div className={classnames(classes.root, containerClass)}>
      <InputLabel
        className={classnames('form-control-label')}
      >
        {label}
      </InputLabel>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs>
          <Slider
            className={classnames(sliderClass)}
            value={value}
            onChange={handleSliderChange}
            aria-labelledby="input-slider"
            max={maxValue}
            min={minValue}
            disabled={disabled}
          />
        </Grid>
        {
          !withoutInput && (
            <Grid item>
              <Input
                className={classnames(classes.input, inputClass)}
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
            </Grid>
          )
        }
      </Grid>
    </div>
  );
};

FormSlider.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  sliderWidth: PropTypes.number,
  inputWidth: PropTypes.number,
  minValue: PropTypes.number,
  withoutInput: PropTypes.bool,
  maxValue: PropTypes.number,
  containerClass: PropTypes.string,
  sliderClass: PropTypes.string,
  inputClass: PropTypes.string,
  disabled: PropTypes.bool,
};

FormSlider.defaultProps = {
  label: '',
  maxValue: 100,
  minValue: 0,
  value: 0,
  disabled: false,
};

export default FormSlider;
