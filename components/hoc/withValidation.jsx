import * as React from 'react';

import Error from '../common/snackBars/Error';

import * as VALIDATORS from '../../lib/validators';

const required = VALIDATORS.required();

const withValidation = (WrappedComponent) => (props) => {
  const [error, setError] = React.useState(null);

  const checkValue = (value, options = {}) => {
    const { type = null, isRequired = false } = options;
    if (isRequired) {
      const e = required(value);
      if (e) {
        setError(e);
        return;
      }
    }
    if (type) {
      const e = VALIDATORS.default[type]({ value });
      if (e) {
        setError(e);
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
      <Error {...props} message={error} handleClose={() => setError(null)} />
    </React.Fragment>
  );
};

export default withValidation;
