import React from 'react';
import { Input } from 'reactstrap';

import PropTypes from '../../lib/PropTypes';

const FormCheckboxField = (props) => {
  const { onChange, value, disabled, label } = props;

  return (
    <div>
      <Input
        type="checkbox"
        disabled={disabled}
        checked={value}
        onChange={onChange(!value)}
      />
      <div
        onClick={onChange(!value)}
        role="button"
        tabIndex="0"
        onKeyDown={onChange(!value)}
      >
        {label}
      </div>
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
