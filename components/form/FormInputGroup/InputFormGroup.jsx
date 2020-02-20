import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { FormFeedback, FormGroup, FormText, Input, Label } from 'reactstrap';
import { observable, action } from 'mobx';

import { required, minLength, wrongPattern } from '../../../lib/validators';

const InputFormGroup = observer(({
  name,
  label,
  placeholder = label,
  valueHolder,
  inputType,
  step,
  disabled,
  hint,
  onKeyDown,
  minLength: minFieldLength,
  required: requiredField,
  patternOptions,
  handler,
  ...restProps
}) => {
  let error;
  observable(error);

  const handleChange = (event) => {
    const { value } = event.target;
    const e = (requiredField && required()(value))
      || minLength({ value, length: minFieldLength })
      || wrongPattern({ ...patternOptions, value });
    handler({
      ...valueHolder,
      value,
      e,
    }, name);
    error = e;
  };

  action(handleChange);

  const renderInput = () => (
    <Input
      type={inputType}
      id={name}
      name={name}
      placeholder={placeholder}
      valid={!error && !valueHolder.error}
      value={valueHolder.value || ''}
      onKeyDown={onKeyDown}
      onChange={handleChange}
      step={step}
      disabled={disabled}
    />
  );

  return (
    <FormGroup {...restProps}>
      {label && (
        <Label
          className={(error || valueHolder.error) ? 'invalid' : ''}
          for={name}
        >
          {label}
        </Label>
      )}
      {renderInput()}
      <FormFeedback>
        {error || valueHolder.error}
      </FormFeedback>
      {hint && <FormText color="muted">{hint}</FormText>}
    </FormGroup>
  );
});

InputFormGroup.propTypes = {
  handler: PropTypes.func.isRequired,
  hint: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  inputType: PropTypes.string,
  patternOptions: PropTypes.shape({
    message: PropTypes.string,
    pattern: PropTypes.string,
  }),
  label: PropTypes.oneOfType([PropTypes.string.isRequired, PropTypes.bool.isRequired]),
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  valueHolder: PropTypes.shape({
    error: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
    type: PropTypes.any,
    value: PropTypes.any,
  }).isRequired,
  step: PropTypes.number,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  minLength: PropTypes.number,
  onKeyDown: PropTypes.func,
};

InputFormGroup.defaultProps = {
  inputType: 'text',
  onKeyDown: () => {},
};

export default InputFormGroup;
