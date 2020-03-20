import React from 'react';
import { useField } from 'formik';
import PropTypes from '../../lib/PropTypes';

import FormColor from './FormColor';
import FormRadioButton from './FormRadioButton';
import FormTextField from './FormTextField';
import FormSelect from './FormSelect';
import FormList from './FormList';
import FormCheckboxField from './FormCheckboxField';
import FormSlider from './FormSlider';

const inputs = {
  input: FormTextField,
  color: FormColor,
  radio: FormRadioButton,
  select: FormSelect,
  list: FormList,
  checkbox: FormCheckboxField,
  slider: FormSlider,
};

const FieldBuilder = (props) => {
  const { type, onChange } = props;
  const [field, meta, helpers] = useField(props);

  const handleChange = value => {
    helpers.setValue(value);
    onChange(value);
  };

  const InputComponent = inputs[type];

  return (
    <InputComponent {...props} {...field} {...meta} onChange={handleChange} />
  );
};

FieldBuilder.propTypes = {
  type: PropTypes.string,
  onChange: PropTypes.func,
  name: PropTypes.string.isRequired,
};

export default FieldBuilder;
