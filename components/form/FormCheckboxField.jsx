import React, { useEffect, useState } from 'react';
import { Input } from 'reactstrap';

import PropTypes from '../../lib/PropTypes';

const FormCheckboxField = (props) => {
  const { onChange, value: defaultValue, disabled, label } = props;

  const [value, setValue] = useState(defaultValue || false);

  useEffect(() => {
    onChange(value);
  }, [onChange, value]);

  const onClick = () => {
    setValue(!value);
  };

  return (
    <div>
      <Input
        type="checkbox"
        disabled={disabled}
        checked={value}
        onChange={onClick}
      />
      {label}
    </div>
  );
};

FormCheckboxField.propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.bool,
  disabled: PropTypes.bool,
  label: PropTypes.string,
};

FormCheckboxField.defaultProps = {
  disabled: false,
  onChange: () => {},
};

export default FormCheckboxField;
