import React from 'react';

import PropTypes from '../../lib/PropTypes';
import FormColor from './FormColor';
import FormRadioButton from './FormRadioButton';
import FormTextField from './FormTextField';
import FormSelect from './FormSelect';
import FormList from './FormList';
import FormCheckboxField from './FormCheckboxField';
import FormSlider from './FormSlider';
import TimeInput from './TimeInput';
// import TextInput from './TextInput';

const inputs = {
  time: TimeInput,
  number: FormTextField,
  input: FormTextField,
  // number: TextInput,
  // input: TextInput,
  color: FormColor,
  radio: FormRadioButton,
  select: FormSelect,
  list: FormList,
  checkbox: FormCheckboxField,
  slider: FormSlider,
};

const FieldBuilder = ({ onChange, value, ...props }) => {
  console.log('FieldBuilder props.value', value);
  const { name, type } = props;

  const handleChangeField = val => {
    console.log('FieldBuilder handleChangeField(val) => ', val);
    onChange({ [name]: val });
  };

  const InputComponent = inputs[type];

  return (
    <InputComponent {...props} value={value} onChange={handleChangeField} />
  );
};

FieldBuilder.propTypes = {
  type: PropTypes.string,
  onChange: PropTypes.func,
  name: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default FieldBuilder;
