import React from 'react';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';

const FormRadioButton = (props) => {
  const { items, groupName, onChange, value } = props;

  const handleChange = event => {
    onChange(event.target.value);
  };

  return (
    <FormControl component="fieldset">
      <RadioGroup
        name={groupName}
        value={value}
        onChange={handleChange}
        row
      >
        {items.map((item,i) => (
          <FormControlLabel
            key={groupName + i}
            value={item.value}
            control={(
              <Radio
                disableRipple
                checkedIcon={<SVGInline className="radio-button-icon" svg={item.checkedIcon} cleanup={['title']} />}
                icon={<SVGInline className="radio-button-icon" svg={item.icon} cleanup={['title']} />}
                position={item.position||'start'}
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
      PropTypes.string, PropTypes.number, PropTypes.bool
    ]),
    label: PropTypes.string,
    position: PropTypes.string,
    icon: PropTypes.string,
  })).isRequired,
  groupName: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string,
};

FormRadioButton.defaultProps = {
  groupName: 'default',
};

export default FormRadioButton;
