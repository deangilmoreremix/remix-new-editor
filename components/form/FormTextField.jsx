import React, { useState, useEffect } from 'react';
import { Col, Label, FormGroup, Input } from 'reactstrap';
import MaskedFormControl from 'react-bootstrap-maskedinput';

import PropTypes from '../../lib/PropTypes';


export default function FormTextField(props) {
  const {
    type,
    mask,
    label,
    effect,
    onEnter,
    disabled,
    labelCol,
    className,
    controlCol,
    placeholder,
    inlineLayout,
    value: defaultValue,
  } = props;

  const conditionalProps = {};
  const [value, setValue] = useState(defaultValue || '');

  if (onEnter) {
    conditionalProps.onKeyPress = ({ which }) => {
      if (which === 13) {
        onEnter(value);
        setValue('');
      }
    };
  }

  useEffect(() => {
    effect(value);
  });

  const onChange = ({ target: { value: v } }) => {
    setValue(v);
  };

  const getLabel = () => (<Label key="label-key" className="form-control-label">{label}</Label>);

  const getInputField = () => (mask
    ? (
      <MaskedFormControl
        mask={mask}
        key="masked-input-key"
        id={label}
        value={value}
        className="form-control"
        placeholder={placeholder}
        onChange={onChange}
        type={type}
        disabled={disabled}
        {...conditionalProps}
      />
    )
    : (
      <Input
        key="input-key"
        id={label}
        className="form-control"
        value={value || ''}
        placeholder={placeholder}
        onChange={onChange}
        type={type}
        disabled={disabled}
        {...conditionalProps}
      />
    )
  );

  return (
    <FormGroup
      className={className}
    >
      {inlineLayout
        ? [
          <Col {...labelCol} key="text-field-label">
            {getLabel()}
          </Col>,
          <Col {...controlCol} key="text-field-input">
            {getInputField()}
          </Col>,
        ]
        : [getLabel(), getInputField()]
      }
    </FormGroup>
  );
}

FormTextField.propTypes = {
  effect: PropTypes.func,
  mask: PropTypes.string,
  label: PropTypes.string,
  onEnter: PropTypes.func,
  disabled: PropTypes.bool,
  inputType: PropTypes.string,
  className: PropTypes.string,
  inlineLayout: PropTypes.bool,
  placeholder: PropTypes.string,
  type: PropTypes.oneOf(['input', 'textarea', 'select']),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({})]),
};

FormTextField.defaultProps = {
  label: '',
  type: 'input',
  disabled: false,
  effect: () => {},
  inputType: 'text',
  inlineLayout: true,
};
