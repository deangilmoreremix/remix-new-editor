import * as React from 'react';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const TextInput = ({
  name,
  label,
  type = 'text',
  onChange,
  onEnter,
  disabled,
  inputClassName,
  labelClassName,
  className,
  placeholder,
  value,
}) => (
  <div className={classnames('field-container', className)}>
    <label htmlFor={name} className={classnames('field-label', labelClassName)}>
      {label}
    </label>
    <input
      name={name}
      className={classnames('field-input', inputClassName)}
      type={type}
      placeholder={placeholder}
      onChange={({ target: { value: v } }) => onChange(v)}
      disabled={disabled}
      value={value}
      {...(onEnter ? { onEnter } : {})}
    />
  </div>
);

TextInput.propTypes = {
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  label: PropTypes.string,
  type: PropTypes.string,
  onEnter: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({})]),
};

export default TextInput;
