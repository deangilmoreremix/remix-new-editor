import React, { useEffect, useState } from 'react';
import { Input } from 'reactstrap';

import PropTypes from '../../lib/PropTypes';

const FormCheckboxField = (props) => {
  const { effect, value: defaultValue, disabled, label, inline } = props;

  const [value, setValue] = useState(defaultValue || false);

  useEffect(() => {
    effect(value);
  }, [effect, value]);

  const onChange = () => {
    setValue(!value);
  };

  return (
    <div>
      <Input
        type="checkbox"
        disabled={disabled}
        // inline={inline}
        checked={value}
        onChange={onChange}
      />
      {label}
    </div>
  );
};

FormCheckboxField.propTypes = {
  effect: PropTypes.func,
  value: PropTypes.bool,
  inline: PropTypes.bool,
  disabled: PropTypes.bool,
  label: PropTypes.string,
};

FormCheckboxField.defaultProps = {
  disabled: false,
  inline: true,
  effect: () => {},
};

export default FormCheckboxField;
