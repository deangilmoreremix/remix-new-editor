import React, { useState } from 'react';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';

const FormRadioButton = (props) => {
  const { items, groupName, onChange, value, containerClass } = props;
  const [startValue, setValue] = useState(value);

  const handleChange = event => {
    const { value: val } = event.target;
    onChange(val);
    setValue(val);
  };

  return (
    <FormControl component="fieldset" className={containerClass}>
      <RadioGroup
        name={groupName}
        value={startValue}
        onChange={handleChange}
        row
      >
        {items.map((item, i) => (
          <FormControlLabel
            key={groupName + i}
            value={item.value}
            control={(
              <Radio
                disableRipple
                checkedIcon={<SVGInline className="radio-button-icon icon-svg-checked" svg={item.checkedIcon || item.icon} cleanup={['title']} />}
                icon={<SVGInline className="radio-button-icon" svg={item.icon} cleanup={['title']} />}
                position={item.position || 'start'}
              />
)}
            label={item.label}
            labelPlacement={item.position}
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
};

FormRadioButton.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.oneOfType([
      PropTypes.string, PropTypes.number, PropTypes.bool,
    ]),
    label: PropTypes.string,
    position: PropTypes.string,
    icon: PropTypes.string,
  })).isRequired,
  groupName: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string,
  containerClass: PropTypes.string,
};

FormRadioButton.defaultProps = {
  groupName: 'default',
};

export default FormRadioButton;
