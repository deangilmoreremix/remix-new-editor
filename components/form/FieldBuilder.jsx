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

const inputs = {
  time: TimeInput,
  number: FormTextField,
  input: FormTextField,
  color: FormColor,
  radio: FormRadioButton,
  select: FormSelect,
  list: FormList,
  checkbox: FormCheckboxField,
  slider: FormSlider,
};

const FieldBuilder = (props) => {
  console.log('FieldBuilder ', props);
  const { name, type, onChange } = props;

  const handleChangeField = value => {
    onChange({ [name]: value });
  };

  const InputComponent = inputs[type];

  return (
    <InputComponent {...props} onChange={handleChangeField} />
  );
};

FieldBuilder.propTypes = {
  type: PropTypes.string,
  onChange: PropTypes.func,
  name: PropTypes.string.isRequired,
};

export default FieldBuilder;
