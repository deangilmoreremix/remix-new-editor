// TODO: should be removed after a new component is created instead this one
import React from 'react';
import FormGroup from '@material-ui/core/FormGroup';
import InputLabel from '@material-ui/core/InputLabel';
import TextField from '@material-ui/core/TextField';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

export default function FormTextField({
  type,
  label,
  onChange,
  onEnter,
  disabled,
  inputClassName,
  labelClassName,
  className,
  placeholder,
  value,
}) {
  const conditionalProps = {};

  if (onEnter) {
    conditionalProps.onKeyPress = ({ which, target: { value: v } }) => {
      if (which === 13) {
        onEnter(v);
      }
    };
  }

  const onEdit = ({ target: { value: v } }) => {
    onChange(v);
  };

  return (
    <FormGroup
      className={classnames(className)}
    >
      <InputLabel key="label-key" className={classnames('form-control-label', labelClassName)}>
        {label}
      </InputLabel>
            <TextField
              key="input-key"
              id={label}
              className={classnames(inputClassName,
                type === 'input' && 'text-input',
                type === 'number' && 'text-input',
              )}
              value={value || (value === 0 && type === 'number') ? value : ''}
              placeholder={placeholder}
              onChange={onEdit}
              type={type}
              disabled={disabled}
              {...conditionalProps}
            />
    </FormGroup>
  );
}

FormTextField.propTypes = {
  onChange: PropTypes.func,
  label: PropTypes.string,
  onEnter: PropTypes.func,
  disabled: PropTypes.bool,
  inputType: PropTypes.string,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  inline: PropTypes.bool,
  placeholder: PropTypes.string,
  type: PropTypes.oneOf(['input', 'textarea', 'select', 'number']),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({})]),
};

FormTextField.defaultProps = {
  label: '',
  type: 'input',
  disabled: false,
  onChange: () => {},
  inputType: 'text',
  inline: true,
};
