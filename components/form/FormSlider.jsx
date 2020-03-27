import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Slider from '@material-ui/core/Slider';
import Input from '@material-ui/core/Input';
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
    componentClasses: {
      containerClass,
      sliderClass,
      inputClass,
    },
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
    if (val && !isNaN(val)) {
      onChange(parseInt(val));
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
      <Typography id="input-slider" gutterBottom>
        {label}
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs>
          <Slider
            className={classnames(sliderClass)}
            value={value}
            onChange={handleSliderChange}
            aria-labelledby="input-slider"
            max={maxValue}
          />
        </Grid>
        {!withoutInput && (
          <Grid item>
            <Input
              className={classnames(classes.input, inputClass)}
              value={value}
              margin="dense"
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
  componentClasses: PropTypes.objectOf(PropTypes.shape({
    containerClass: PropTypes.string,
    sliderClass: PropTypes.string,
    inputClass: PropTypes.string,
  })),
};

FormSlider.defaultProps = {
  label: '',
  maxValue: 100,
  minValue: 0,
  componentClasses: {},
  value: 0,
};

export default FormSlider;
