import React from 'react';
import { Input } from 'reactstrap';

import PropTypes from '../../lib/PropTypes';

const FormCheckboxField = (props) => {
  const { onChange, value, checked, inline, disabled, title, ...rest } = props;
  return (
    <div>
      <Input
        type="checkbox"
        disabled={disabled}
        inline={inline}
        checked={checked}
        onChange={onChange}
        value={value}
        name="checkboxGroup[]"
        {...rest}
      />
      {' '}
      {title}
    </div>
  );
};

FormCheckboxField.propTypes = {
  checked: PropTypes.bool,
  children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),
  inline: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
  disabled: PropTypes.bool,
};

FormCheckboxField.defaultProps = {
  inline: true,
  disabled: false,
};

export default FormCheckboxField;
