
import React from 'react';
import FormGroup from '@material-ui/core/FormGroup';
import InputLabel from '@material-ui/core/InputLabel';
import TextField from '@material-ui/core/TextField';
import classnames from 'classnames';
import MaskedFormControl from 'react-bootstrap-maskedinput';
import TextareaAutosize from '@material-ui/core/TextareaAutosize';

import PropTypes from '../../lib/PropTypes';

export default function FormTextField({
  type,
  mask,
  label,
  name,
  onChange,
  onEnter,
  disabled,
  inputClassName,
  labelClassName,
  className,
  placeholder,
  value,
  multiline,
  rowsMin,
  rowsMax,
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
      { type !== 'textarea' && (
        mask
          ? (
            <MaskedFormControl
              mask={mask}
              key="masked-input-key"
              id={name}
              value={value}
              className={classnames(inputClassName)}
              placeholder={placeholder}
              onChange={onEdit}
              type={type}
              name={name}
              disabled={disabled}
              {...conditionalProps}
            />
          )
          : (
            <TextField
              key="input-key"
              id={name}
              className={classnames('text-input', inputClassName)}
              value={value || (value === 0 && type === 'number') ? value : ''}
              placeholder={placeholder}
              onChange={onEdit}
              type={type}
              disabled={disabled}
              {...conditionalProps}
              multiline={multiline}
            />
          ))}
      {type === 'textarea' && (
        <TextareaAutosize
          key="input-key"
          id={name}
          className={classnames('text-input', inputClassName)}
          value={value || ''}
          placeholder={placeholder}
          onChange={onEdit}
          disabled={disabled}
          {...conditionalProps}
          multiline={multiline}
          rowsMin={rowsMin}
          rowsMax={rowsMax}
        />
      )}

    </FormGroup>
  );
}

FormTextField.propTypes = {
  onChange: PropTypes.func,
  mask: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string,
  onEnter: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  placeholder: PropTypes.string,
  type: PropTypes.oneOf(['input', 'textarea', 'number']),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({})]),
  multiline: PropTypes.bool,
  rowsMin: PropTypes.number,
  rowsMax: PropTypes.number,
};

FormTextField.defaultProps = {
  label: '',
  type: 'input',
  disabled: false,
  onChange: () => {},
};
