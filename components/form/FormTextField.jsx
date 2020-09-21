import React from 'react';
import FormGroup from '@material-ui/core/FormGroup';
import InputLabel from '@material-ui/core/InputLabel';
import TextField from '@material-ui/core/TextField';
import classnames from 'classnames';
import MaskedFormControl from 'react-bootstrap-maskedinput';
import TextareaAutosize from '@material-ui/core/TextareaAutosize';

import PropTypes from '../../lib/PropTypes';

const FormTextField = React.forwardRef(({
  type,
  mask,
  label,
  name,
  onChange,
  onEnter,
  onBlur,
  disabled,
  inputClassName,
  labelClassName,
  className,
  placeholder,
  value,
  multiline,
  rowsMin,
  rowsMax,
  readOnly,
  onFocus,
  labelHint,
}, ref) => {
  const conditionalProps = {};

  const InputProps = {
    ...(readOnly ? { readOnly } : {}),
  };

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
      onBlur={onBlur}
    >
      {
        label && (
          <InputLabel key="label-key" className={classnames('form-control-label', labelClassName)}>
            {label}
          </InputLabel>
        )
      }
      {labelHint && (<span className="label-input-hint">{labelHint}</span>)}
      { type !== 'text' && (
        mask
          ? (
            <MaskedFormControl
              ref={ref}
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
              InputProps={InputProps}
              {...conditionalProps}
            />
          )
          : (
            <TextField
              inputRef={ref}
              key="input-key"
              id={name}
              className={classnames(inputClassName, 'text-input', { 'input-disabled': disabled })}
              value={value || (value === 0 && type === 'number') ? value : ''}
              placeholder={placeholder}
              onChange={onEdit}
              type={type}
              disabled={disabled}
              {...conditionalProps}
              multiline={multiline}
              InputProps={InputProps}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          ))}
      {type === 'text' && (
        <TextareaAutosize
          ref={ref}
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
          readOnly={readOnly}
        />
      )}

    </FormGroup>
  );
});

FormTextField.propTypes = {
  onChange: PropTypes.func.isRequired,
  mask: PropTypes.string,
  label: PropTypes.string,
  labelHint: PropTypes.string,
  name: PropTypes.string,
  onEnter: PropTypes.func,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  placeholder: PropTypes.string,
  type: PropTypes.oneOf(['input', 'text', 'number']),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({})]),
  multiline: PropTypes.bool,
  rowsMin: PropTypes.number,
  rowsMax: PropTypes.number,
  readOnly: PropTypes.bool,
};

FormTextField.defaultProps = {
  label: '',
  type: 'input',
  disabled: false,
  inputClassName: '',
  labelClassName: '',
  className: '',
  readOnly: false,
  onBlur: () => {},
  onFocus: () => {},
  labelHint: '',
};

export default FormTextField;
