// TODO: should be removed after a new component is created instead this one
import PropTypes from 'prop-types';
import React from 'react';

import InputFormGroup from './InputFormGroup';
import RadioFormGroup from './RadioFormGroup';
import SelectFormGroup from './SelectFormGroup';

const FormInputGroup = (props) => {
  const { inputType, ...restProps } = props;
  if (inputType === 'select') {
    return <SelectFormGroup {...restProps} />;
  } else if (inputType === 'radio') {
    return <RadioFormGroup {...restProps} />;
  } else {
    return <InputFormGroup inputType={inputType} {...restProps} />;
  }
};
FormInputGroup.propTypes = {
  inputType: PropTypes.string,
};
FormInputGroup.defaultProps = {
  inputType: 'text',
};

export default FormInputGroup;
