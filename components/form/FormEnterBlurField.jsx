import React from 'react';

import PropTypes from '../../lib/PropTypes';
import FormTextField from './FormTextField';
import { INPUT } from '../../lib/constants/forms';

const FormEnterBlurField = ({ value, onChange, ...rest }) => {
  const [src, setSrc] = React.useState('');

  React.useEffect(() => {
    setSrc(value);
  }, [value]);

  const onSave = () => {
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
