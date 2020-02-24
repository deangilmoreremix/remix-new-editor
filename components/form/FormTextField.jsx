import React from 'react';
import { Col, Label, FormGroup, Input } from 'reactstrap';
import MaskedFormControl from 'react-bootstrap-maskedinput';

import PropTypes from '../../lib/PropTypes';


export default function FormTextField(props) {
  const {
    type,
    mask,
    label,
    onChange,
    onEnter,
    disabled,
    labelCol,
    className,
    controlCol,
    placeholder,
    inline,
    value,
  } = props;

  const conditionalProps = {};

  if (onEnter) {
    conditionalProps.onKeyPress = ({ which, target: { value: v } }) => {
      if (which === 13) {
        onEnter(v);
      }
    };
  }

  const onEdit = ({ target: { value: v } }) => {
    onChange(v);
  };

  const renderLabel = () => (<Label key="label-key" className="form-control-label">{label}</Label>);

  const renderInputField = () => (mask
    ? (
      <MaskedFormControl
        mask={mask}
        key="masked-input-key"
        id={label}
        value={value}
        className="form-control"
        placeholder={placeholder}
        onChange={onEdit}
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
        onChange={onEdit}
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
      {inline
        ? [
          <Col {...labelCol} key="text-field-label">
            {renderLabel()}
          </Col>,
          <Col {...controlCol} key="text-field-input">
            {renderInputField()}
          </Col>,
        ]
        : [renderLabel(), renderInputField()]
      }
    </FormGroup>
  );
}

FormTextField.propTypes = {
  onChange: PropTypes.func,
  mask: PropTypes.string,
  label: PropTypes.string,
  onEnter: PropTypes.func,
  disabled: PropTypes.bool,
  inputType: PropTypes.string,
  className: PropTypes.string,
  inline: PropTypes.bool,
  placeholder: PropTypes.string,
  type: PropTypes.oneOf(['input', 'textarea', 'select']),
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({})]),
};

FormTextField.defaultProps = {
  label: '',
  type: 'input',
  disabled: false,
  onChange: () => {},
  inputType: 'text',
  inline: true,
};
