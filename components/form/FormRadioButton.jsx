import React, { useState } from 'react';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';

import PropTypes from '../../lib/PropTypes';

const FormRadioButton = ({ items }) => {
  const [value, setValue] = useState('');

  const handleChange = event => {
    setValue(event.target.value);
  };

  return (
    <FormControl component="fieldset">
      <RadioGroup aria-label="position" name="position" value={value} onChange={handleChange} row>
        {items.map((el) => (
          <FormControlLabel
            key={el.label}
            value={el.label}
            control={<Radio />}
            label={el.label}
            labelPlacement={el.labelPlacement}
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
};

// labelPlacement - label position relative to radiobutton
// values of labelPlacement : {'top' - top position, 'start' - left position label
// 'end' - right position label, bottom - bottom position label}

FormRadioButton.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    labelPlacement: PropTypes.string.isRequired,
  })).isRequired,
};

export default FormRadioButton;
