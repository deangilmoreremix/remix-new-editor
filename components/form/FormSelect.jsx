import React, { useState, useEffect, useCallback } from 'react';
import InputLabel from '@material-ui/core/InputLabel';
import Select from 'react-select';
import classnames from 'classnames';
import FormGroup from '@material-ui/core/FormGroup';
import Box from '@material-ui/core/Box';
import PropTypes from '../../lib/PropTypes';
import * as VALIDATORS from '../../lib/validators';

import { FONT_FAMILY } from '../../lib/constants/popcorn';

const FormSelect = React.forwardRef((props, ref) => {
  const {
    items,
    label,
    onChange,
    dataIsRequired,
    value,
    className,
    labelClassName,
    selectClassName,
    disabled,
    validationProps,
    onValidationChange,
    name,
    error: externalError,
    helperText: externalHelperText,
    ...rest
  } = props;

  const [internalError, setInternalError] = useState(null);
  const [internalHelperText, setInternalHelperText] = useState(null);
  const [touched, setTouched] = useState(false);

  // Validation logic
  const validateValue = useCallback((val) => {
    if (!validationProps) return null;

    const {
      type: validationType,
      isRequired = false,
      message,
    } = validationProps;

    if (isRequired && (val === null || val === undefined || val === '')) {
      return VALIDATORS.required({ message: message || 'This field is required' })(val);
    }

    if (validationType && val) {
      const validator = VALIDATORS.default[validationType];
      if (validator) {
        return validator({ value: val, message });
      }
    }

    return null;
  }, [validationProps]);

  // Validate on value change when touched
  useEffect(() => {
    if (validationProps && touched) {
      const validationError = validateValue(value);
      setInternalError(validationError);
      setInternalHelperText(validationError || externalHelperText);

      if (onValidationChange && name) {
        onValidationChange(name, !validationError);
      }
    }
  }, [value, validationProps, touched, validateValue, externalHelperText, onValidationChange, name]);

  const handleChange = data => {
    onChange(dataIsRequired ? data : data.value);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const fontFamily = {
    option: (styles, { data }) => ({
      ...styles,
      fontFamily: data.value,
    }),
  };

  const currentError = externalError || internalError;
  const currentHelperText = externalHelperText || internalHelperText;

  // Generate unique IDs for accessibility
  const labelId = `${name}-label`;
  const errorId = currentError ? `${name}-error` : undefined;
  const helperId = currentHelperText ? `${name}-helper` : undefined;

  return (
    <FormGroup className={classnames(className, {
      'select-element-disabled': disabled,
      'form-field-error': currentError,
      'form-field-success': !currentError && touched && value !== null && value !== undefined && value !== '',
      'form-field-touched': touched,
    })}>
      <Box>
        {
          label && (
            <InputLabel
              id={labelId}
              className={classnames(labelClassName)}
              htmlFor={`${name}-select`}
            >
              {label}
              {validationProps?.isRequired && <span className="required-indicator" aria-label="required">*</span>}
            </InputLabel>
          )
        }
        <Select
          ref={ref}
          className={classnames('select-element', selectClassName, {
            'select-error': currentError,
            'select-success': !currentError && touched && value !== null && value !== undefined && value !== '',
          })}
          classNamePrefix="select"
          defaultValue={items.find(item => item.value === value)}
          onChange={handleChange}
          onBlur={handleBlur}
          options={items}
          value={items.find(i => i.value === value)}
          styles={rest.name === FONT_FAMILY && fontFamily}
          isDisabled={disabled}
          inputId={`${name}-select`}
          aria-labelledby={labelId}
          aria-describedby={`${errorId || ''} ${helperId || ''}`.trim()}
          aria-invalid={!!currentError}
          aria-required={validationProps?.isRequired}
          {...rest}
        />
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
      </Box>
    </FormGroup>
  );
});

FormSelect.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
  })).isRequired,
  labelClassName: PropTypes.string,
  selectClassName: PropTypes.string,
  className: PropTypes.string,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  label: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  dataIsRequired: PropTypes.bool,
  disabled: PropTypes.bool,
  name: PropTypes.string,
  validationProps: PropTypes.shape({
    type: PropTypes.string,
    isRequired: PropTypes.bool,
    message: PropTypes.string,
    validationType: PropTypes.string,
  }),
  onValidationChange: PropTypes.func,
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  helperText: PropTypes.string,
};

FormSelect.defaultProps = {
  labelClassName: 'select-label-top',
  disabled: false,
  dataIsRequired: false,
};

export default FormSelect;
