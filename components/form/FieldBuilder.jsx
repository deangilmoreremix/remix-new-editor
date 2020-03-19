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
  input: (props) => <FormTextField {...props} />,
  color: (props) => <FormColor {...props} />,
  radio: (props) => <FormRadioButton {...props} />,
  select: (props) => <FormSelect {...props} />,
  list: (props) => <FormList {...props} />,
  checkbox: (props) => <FormCheckboxField {...props} />,
  slider: (props) => <FormSlider {...props} />,
};

const FieldBuilder = (props) => {
  const { type, onChange, name } = props;
  const [field, meta, helpers] = useField(props);

  const handleChange = value => {
    helpers.setValue(value);
    onChange(value);
  };

  const checkProps = (data) => {
    if (!data.value) {
      const newProps = data;
      delete newProps.value;
      return { ...newProps, onChange: handleChange, name };
    } else {
      return { ...data, onChange: handleChange, name };
    }
  };

  return (
    <div>
      {
          type
            ? inputs[type](checkProps({ ...props, ...field }))
            : inputs.input(checkProps({ ...props, ...field }))
      }

      {meta.touched && meta.error ? (
        <div className="field-error">{meta.error}</div>
      ) : null}
    </div>
  );
};

FieldBuilder.propTypes = {
  type: PropTypes.string,
  onChange: PropTypes.func,
  name: PropTypes.string.isRequired,
};

export default FieldBuilder;
