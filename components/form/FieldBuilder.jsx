import React from 'react';
import PropTypes from '../../lib/PropTypes';

import FormColor from './FormColor';
import FormRadioButton from './FormRadioButton';
import FormTextField from './FormTextField';
import FormSelect from './FormSelect';
import FormList from './FormList';
import FormCheckboxField from './FormCheckboxField';
import FormSlider from './FormSlider';
import AngleInput from './AngleInput';
import FormTextArea from './FormTextArea';

const inputs = {
  inputTextRotation: AngleInput,
  textarea: FormTextArea,
  input: FormTextField,
  time: FormTextField,
  number: FormTextField,
  color: FormColor,
  radio: FormRadioButton,
  select: FormSelect,
  list: FormList,
  checkbox: FormCheckboxField,
  slider: FormSlider,
};

const FieldBuilder = (props) => {
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
