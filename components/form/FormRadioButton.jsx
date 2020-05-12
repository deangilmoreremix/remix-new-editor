import React from 'react';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../lib/PropTypes';

const FormRadioButton = (props) => {
  const { items, groupName, onChange, value, containerClassName, label, radioClassName } = props;

  const handleChange = event => {
    const { value: val } = event.target;
    onChange(val);
  };

  return (
    <FormControl component="fieldset" className={containerClassName}>
      {label && <label className="form-control-label">{label}</label>}
      <RadioGroup
        name={groupName}
        value={value}
        onChange={handleChange}
        row
        className={radioClassName}
      >
        {items.map((item) => (
          <FormControlLabel
            key={item.value}
            value={item.value}
            control={(
              <Radio
                disableRipple
                checkedIcon={<SVGInline className="radio-button-icon icon-svg-checked" svg={item.checkedIcon || item.icon} cleanup={['title']} />}
                icon={<SVGInline className="radio-button-icon" svg={item.icon} cleanup={['title']} />}
                position={item.position}
              />
)}
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
  containerClassName: PropTypes.string,
  label: PropTypes.string,
  radioClassName: PropTypes.string,
};

FormRadioButton.defaultProps = {
  groupName: 'default',
};

export default FormRadioButton;
