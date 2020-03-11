import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Slider from '@material-ui/core/Slider';
import Input from '@material-ui/core/Input';

import PropTypes from '../../lib/PropTypes';

// TODO need to move this to the file of consts.js in future after merge all chnages
const SLIDER_INPUT_STEP = 10;

const useStyles = makeStyles({
  root: {
    width: 250,
  },
  input: {
    width: 42,
  },
});

function FormSlider(props) {
  const { value, onChange, label } = props;
  const classes = useStyles();

  const handleSliderChange = (event, newValue) => {
    onChange(newValue);
  };

  const handleInputChange = event => {
    const { value: val } = event.target;
    onChange(isNaN(val) ? '' : val);
  };

  const handleBlur = () => {
    if (value < 0) {
      onChange(0);
    } else if (value > 100) {
      onChange(100);
    }
  };

  return (
    <div className={classes.root}>
      <Typography id="input-slider" gutterBottom>
        { label }
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs>
          <Slider
            value={value || 0}
            onChange={handleSliderChange}
            aria-labelledby="input-slider"
          />
        </Grid>
        <Grid item>
          <Input
            className={classes.input}
            value={value}
            margin="dense"
            onChange={handleInputChange}
            onBlur={handleBlur}
            inputProps={{
              step: SLIDER_INPUT_STEP,
              min: 0,
              max: 100,
              type: 'number',
              'aria-labelledby': 'input-slider',
            }}
          />
        </Grid>
      </Grid>
    </div>
  );
}

FormSlider.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func,
  label: PropTypes.string,
};

FormSlider.defaultProps = {
  value: 0,
  onChange: () => {},
  label: '',
};

export default FormSlider;
