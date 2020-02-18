import React, { useState, useEffect } from 'react';
import {
  Col,
  Label,
  FormGroup,
  Input,
} from 'reactstrap';
import MaskedFormControl from 'react-bootstrap-maskedinput';

import PropTypes from '../../lib/PropTypes';


export default function FormTextField(props) {
  const {
    label,
    placeholder,
    type,
    effect,
    inlineLayout,
    labelCol,
    value: defaultValue,
    controlCol,
    className,
    disabled,
    mask,
  } = props;

  const [value, setValue] = useState(defaultValue || '');

  useEffect(() => {
    effect(value);
  });

  const onChange = ({ target: { value: v } }) => {
    setValue(v);
  };

  const getLabel = () => (
    <Label key="label-key" className="form-control-label">{label}</Label>);

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
      />
    )
  );

  return (
    <FormGroup
      controlId={label}
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
  type: PropTypes.oneOf(['input', 'textarea', 'select']),
  label: PropTypes.string,
  placeholder: PropTypes.string,
  effect: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({})]),
  inputType: PropTypes.string,
  labelCol: PropTypes.shape({
    lg: PropTypes.number,
    md: PropTypes.number,
    sm: PropTypes.number,
    xs: PropTypes.number,
  }),
  controlCol: PropTypes.shape({
    lg: PropTypes.number,
    md: PropTypes.number,
    sm: PropTypes.number,
    xs: PropTypes.number,
  }),
  inlineLayout: PropTypes.bool,
  disabled: PropTypes.bool,
  mask: PropTypes.string,
  className: PropTypes.string,
};

FormTextField.defaultProps = {
  type: 'input',
  inputType: 'text',
  disabled: false,
  label: '',
  inlineLayout: true,
  effect: () => {},
};
