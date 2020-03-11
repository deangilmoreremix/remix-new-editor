// TODO: should be removed after a new component is created instead this one
import React from 'react';
import { Input } from 'reactstrap';

import PropTypes from '../../lib/PropTypes';

const FormCheckboxField = (props) => {
  const { onChange, value, disabled, label } = props;

  const onClick = () => {
    onChange(!value);
  };

  return (
    <div>
      <Input
        type="checkbox"
        disabled={disabled}
        checked={value}
        onChange={onClick}
      />
      <div
        onClick={onClick}
        role="button"
        tabIndex="0"
        onKeyDown={onClick}
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
