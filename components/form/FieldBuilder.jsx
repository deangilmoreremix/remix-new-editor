import React from 'react';
import { useField } from 'formik';
import PropTypes from '../../lib/PropTypes';
// Inputs
import FormCheckboxField from './FormCheckboxField';
import FormColor from './FormColor';
import FormList from './FormList';
import FormTextField from './FormTextField';

const inputs = {
  text: FormTextField,
  select: FormList,
  color: FormColor,
  checkbox: FormCheckboxField,
};

// ===== Component =====
const FieldBuilder = (props) => {
  const { type, placeholder, onChange } = props;
  const [field, meta, helpers] = useField(props);

  const handleChange = (value) => {
    helpers.setValue(value);
    onChange(value);
  };
  return (
    <div>
      {
          type ?
              inputs[type]({...field, ...props, onChange: handleChange})
          : inputs.text({...field, ...props, onChange: handleChange})
      }

      {/*<input*/}
      {/*  type={type}*/}
      {/*  {...field}*/}
      {/*  placeholder={placeholder || field.name}*/}
      {/*  onChange={handleChange}*/}
      {/*/>*/}

      {meta.touched && meta.error ? (
        <div className="field-error">{meta.error}</div>
      ) : null}
    </div>
  );
};
// ===== Component =====

// ===== PropTypes =====
FieldBuilder.propTypes = {
  type: PropTypes.string,
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.bool,
  disabled: PropTypes.bool,
  required: PropTypes.bool,
};
// ===== PropTypes =====

export default FieldBuilder;
