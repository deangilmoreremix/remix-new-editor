import React, { useState, useEffect, useCallback } from 'react';
import FormGroup from '@material-ui/core/FormGroup';
import InputLabel from '@material-ui/core/InputLabel';
import TextField from '@material-ui/core/TextField';
import classnames from 'classnames';
import MaskedFormControl from 'react-bootstrap-maskedinput';
import TextareaAutosize from '@material-ui/core/TextareaAutosize';

import PropTypes from '../../lib/PropTypes';
import * as VALIDATORS from '../../lib/validators';

const FormTextField = React.forwardRef(({
  id,
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
  labelHint,
  error: externalError,
  helperText: externalHelperText,
  onEdit: defaultOnEdit,
  inputClass,
  validationProps,
  onValidationChange,
}, ref) => {
  const conditionalProps = {};
  const [isHint, setIsHint] = useState(false);
  const [internalError, setInternalError] = useState(null);
  const [internalHelperText, setInternalHelperText] = useState(null);
  const [touched, setTouched] = useState(false);

  const InputProps = {
    ...(readOnly ? { readOnly } : {}),
  };

  // Real-time validation
  const validateValue = useCallback((val) => {
    if (!validationProps) return null;

    const {
      type: validationType,
      isRequired = false,
      message,
      validationType: validationLevel,
    } = validationProps;

    if (isRequired && !val && val !== 0) {
      const error = VALIDATORS.required({ message: message || 'This field is required' })(val);
      return error;
    }

    if (validationType && val) {
      const validator = VALIDATORS.default[validationType];
      if (validator) {
        return validator({ value: val, message });
      }
    }

    return null;
  }, [validationProps]);

  // Validate on value change for real-time feedback
  useEffect(() => {
    if (validationProps && touched) {
      const validationError = validateValue(value);
      setInternalError(validationError);
      setInternalHelperText(validationError || externalHelperText);

      if (onValidationChange) {
        onValidationChange(name, !validationError);
      }
    }
  }, [value, validationProps, touched, validateValue, externalHelperText, onValidationChange, name]);

  if (onEnter) {
    conditionalProps.onKeyPress = ({ which, target: { value: v } }) => {
      if (which === 13) {
        onEnter(v);
      }
    };
  }

  const currentError = externalError || internalError;
  const currentHelperText = externalHelperText || internalHelperText;

  if (currentError) {
    conditionalProps.error = true;
  }
  if (currentHelperText) {
    conditionalProps.helperText = currentHelperText;
  }
  if (inputClass) {
    InputProps.className = `${inputClass} text-input`;
  }

  const onEdit = ({ target: { value: v } }) => {
    onChange(v);
  };

  const handleShowHint = () => {
    if (labelHint) {
      setIsHint((prevIsHint) => !prevIsHint);
    }
  };

  const handleBlur = (e) => {
    setTouched(true);
    if (onBlur) {
      onBlur(e);
    }
  };

  const handleFocus = () => {
    handleShowHint();
  };

  // Generate unique IDs for accessibility
  const labelId = `${name}-label`;
  const errorId = currentError ? `${name}-error` : undefined;
  const helperId = currentHelperText ? `${name}-helper` : undefined;

  return (
    <FormGroup
      className={classnames(className, {
        'form-field-error': currentError,
        'form-field-success': !currentError && touched && value,
        'form-field-touched': touched,
      })}
      onBlur={handleBlur}
    >
      {
        label && (
          <InputLabel
            key="label-key"
            id={labelId}
            className={classnames('form-control-label', labelClassName)}
            htmlFor={id || name}
          >
            {label}
            {validationProps?.isRequired && <span className="required-indicator" aria-label="required">*</span>}
          </InputLabel>
        )
      }
      {labelHint && isHint && <span className="label-input-hint">{labelHint}</span>}
      { type !== 'text' && (
        mask
          ? (
            <MaskedFormControl
              ref={ref}
              mask={mask}
              key="masked-input-key"
              id={id || name}
              value={value}
              className={classnames(inputClassName)}
              placeholder={placeholder}
              onChange={defaultOnEdit || onEdit}
              type={type}
              name={name}
              disabled={disabled}
              InputProps={InputProps}
              aria-labelledby={labelId}
              aria-describedby={`${errorId || ''} ${helperId || ''}`.trim()}
              aria-invalid={!!currentError}
              {...conditionalProps}
            />
          )
          : (
            <TextField
              inputRef={ref}
              key="input-key"
              id={id || name}
              name={name}
              className={classnames(inputClassName, {
                'text-input': !inputClass,
                'input-disabled': disabled,
                'input-error': currentError,
                'input-success': !currentError && touched && value,
              })}
              value={value || (value === 0 && type === 'number') ? value : ''}
              placeholder={placeholder}
              onChange={defaultOnEdit || onEdit}
              type={type}
              disabled={disabled}
              {...conditionalProps}
              multiline={multiline}
              InputProps={InputProps}
              onFocus={handleFocus}
              onBlur={handleBlur}
              inputProps={{
                'aria-labelledby': labelId,
                'aria-describedby': `${errorId || ''} ${helperId || ''}`.trim(),
                'aria-invalid': !!currentError,
                'aria-required': validationProps?.isRequired,
              }}
            />
          ))}
      {type === 'text' && (
        <TextareaAutosize
          ref={ref}
          key="input-key"
          id={id || name}
          name={name}
          className={classnames('text-input', inputClassName, {
            'text-input-disabled': readOnly,
            'input-error': currentError,
            'input-success': !currentError && touched && value,
          })}
          value={value || ''}
          placeholder={placeholder}
          onChange={defaultOnEdit || onEdit}
          disabled={disabled}
          {...conditionalProps}
          multiline={multiline}
          rowsMin={rowsMin}
          rowsMax={rowsMax}
          readOnly={readOnly}
          aria-labelledby={labelId}
          aria-describedby={`${errorId || ''} ${helperId || ''}`.trim()}
          aria-invalid={!!currentError}
          aria-required={validationProps?.isRequired}
        />
      )}
      {currentError && (
        <div
          id={errorId}
          className="form-error-message"
          role="alert"
          aria-live="polite"
        >
          {currentError}
        </div>
      )}
      {currentHelperText && !currentError && (
        <div
          id={helperId}
          className="form-helper-text"
        >
          {currentHelperText}
        </div>
      )}
    </FormGroup>
  );
});

FormTextField.propTypes = {
  onChange: PropTypes.func,
  onEdit: PropTypes.func,
  mask: PropTypes.string,
  id: PropTypes.string,
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  helperText: PropTypes.string,
  label: PropTypes.string,
  labelHint: PropTypes.string,
  name: PropTypes.string,
  onEnter: PropTypes.func,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  inputClass: PropTypes.string,
  labelClassName: PropTypes.string,
  placeholder: PropTypes.string,
  type: PropTypes.oneOf(['input', 'text', 'number', 'password']),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({})]),
  multiline: PropTypes.bool,
  rowsMin: PropTypes.number,
  rowsMax: PropTypes.number,
  readOnly: PropTypes.bool,
  validationProps: PropTypes.shape({
    type: PropTypes.string,
    isRequired: PropTypes.bool,
    message: PropTypes.string,
    validationType: PropTypes.string,
  }),
  onValidationChange: PropTypes.func,
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
  labelHint: '',
};

export default FormTextField;
