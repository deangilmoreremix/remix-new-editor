import React from 'react';

import PropTypes from '../../lib/PropTypes';
import ValidatorPropType from '../../lib/propTypes/ValidatorPropType';

import FormTextField from './FormTextField';

import { INPUT } from '../../lib/constants/forms';

const FormEnterBlurField = ({ value, onChange, checkValue, validationProps, ...rest }) => {
  const [src, setSrc] = React.useState('');

  React.useEffect(() => {
    setSrc(value);
  }, [value]);

  const onSave = () => {
    const error = checkValue ? checkValue(src, validationProps) : null;
    if (error) {
      return onChange({ value: src, error });
    }
    if (src !== value) {
      onChange(src);
    }
  };

  return (
    <FormTextField
      onEnter={onSave}
      onBlur={onSave}
      onChange={(e) => {
        setSrc(e);
      }}
      value={src}
      {...rest}
      type={INPUT}
    />
  );
};

FormEnterBlurField.propTypes = {
  onChange: PropTypes.func.isRequired,
  checkValue: PropTypes.func,
  mask: PropTypes.string,
  label: PropTypes.string,
  name: PropTypes.string,
  onEnter: PropTypes.func,
  onBlur: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  placeholder: PropTypes.string,
  type: PropTypes.oneOf(['blurInputField']),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({})]),
  multiline: PropTypes.bool,
  rowsMin: PropTypes.number,
  rowsMax: PropTypes.number,
  readOnly: PropTypes.bool,
  validationProps: ValidatorPropType,
};

FormEnterBlurField.defaultProps = {
  label: '',
  type: 'input',
  disabled: false,
  inputClassName: '',
  labelClassName: '',
  className: '',
  readOnly: false,
};

export default FormEnterBlurField;
