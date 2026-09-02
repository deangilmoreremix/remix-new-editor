import { useState, useCallback, useEffect } from 'react';
import * as VALIDATORS from '../../lib/validators';

/**
 * Custom hook for form field validation with real-time feedback
 * @param {Object} validationProps - Validation configuration
 * @param {string} initialValue - Initial field value
 * @param {Function} onValidationChange - Callback when validation state changes
 * @param {string} fieldName - Name of the field for callbacks
 * @returns {Object} Validation state and handlers
 */
const useFieldValidation = (validationProps, initialValue = '', onValidationChange, fieldName) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);
  const [isValid, setIsValid] = useState(true);

  const validate = useCallback((val) => {
    if (!validationProps) return { error: null, isValid: true };

    const {
      type: validationType,
      isRequired = false,
      message,
    } = validationProps;

    let validationError = null;

    // Check required validation
    if (isRequired) {
      validationError = VALIDATORS.required({ message: message || 'This field is required' })(val);
      if (validationError) {
        return { error: validationError, isValid: false };
      }
    }

    // Check type-specific validation
    if (validationType && val && !validationError) {
      const validator = VALIDATORS.default[validationType];
      if (validator) {
        validationError = validator({ value: val, message });
      }
    }

    return {
      error: validationError,
      isValid: !validationError,
    };
  }, [validationProps]);

  // Validate on value change when field is touched
  useEffect(() => {
    if (touched || value !== initialValue) {
      const { error: validationError, isValid: valid } = validate(value);
      setError(validationError);
      setIsValid(valid);

      if (onValidationChange && fieldName) {
        onValidationChange(fieldName, valid);
      }
    }
  }, [value, touched, validate, onValidationChange, fieldName, initialValue]);

  const handleChange = useCallback((newValue) => {
    setValue(newValue);
  }, []);

  const handleBlur = useCallback(() => {
    setTouched(true);
  }, []);

  const resetValidation = useCallback(() => {
    setError(null);
    setTouched(false);
    setIsValid(true);
    setValue(initialValue);
  }, [initialValue]);

  return {
    value,
    error,
    touched,
    isValid,
    handleChange,
    handleBlur,
    resetValidation,
    validate: () => validate(value),
  };
};

export default useFieldValidation;