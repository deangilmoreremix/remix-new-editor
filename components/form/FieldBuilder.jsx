import React from 'react';
import { useField } from 'formik';
import PropTypes from '../../lib/PropTypes';
// Inputs
import FormColor from './FormColor';
import FormRadioButton from './FormRadioButton';
import FormTextField from './FormTextField';
import FormSelect from './FormSelect';

const inputs = {
  text: FormTextField,
  color: FormColor,
  radio: FormRadioButton,
  select: FormSelect
};

// ===== Component =====
const FieldBuilder = (props) => {
  const { type, onChange } = props;
  const [field, meta, helpers] = useField(props);

  const handleChange = (value) => {
    helpers.setValue(value);
    onChange(value);
  };

  return (
    <div>
      {
          type
            ? inputs[type]({ ...field, ...props, onChange: handleChange })
            : inputs.text({ ...field, ...props, onChange: handleChange })
      }

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
