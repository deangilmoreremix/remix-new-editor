import * as React from 'react';

import Error from '../common/snackBars/Error';
import Warning from '../common/snackBars/Warning';

import * as VALIDATORS from '../../lib/validators';

import { VALIDATION_TYPES } from '../../lib/constants/validator';

const required = VALIDATORS.required();

const messageType = {
  [VALIDATION_TYPES.WARNING]: Warning,
  [VALIDATION_TYPES.ERROR]: Error,
};

const withValidation = (WrappedComponent) => (props) => {
  const [error, setError] = React.useState(null);
  const [errorType, setErrorType] = React.useState(VALIDATION_TYPES.ERROR);

  const Snack = React.useMemo(() => messageType[errorType], [errorType]);

  const checkValue = (value, options = {}) => {
    const {
      type = null,
      isRequired = false,
      message,
      validationType = VALIDATION_TYPES.ERROR,
    } = options;
    if (isRequired) {
      const e = required(value);
      if (e) {
        setErrorType(validationType);
        setError(e);
        return e;
      }
    }
    if (type) {
      const e = VALIDATORS.default[type]({ value, message });
      if (e) {
        setErrorType(validationType);
        setError(e);
        return e;
      }
    }
  };

  return (
    <React.Fragment>
      <WrappedComponent
        {...props}
        checkValue={checkValue}
        setError={(err) => {
          setError(err);
        }}
      />
      <Snack {...props} message={error} handleClose={() => setError(null)} />
    </React.Fragment>
  );
};

export default withValidation;
