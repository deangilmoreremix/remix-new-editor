import React, { useState, useEffect } from 'react';
import {
  Col,
  Label,
  FormGroup,
} from 'reactstrap';
import { HuePicker } from 'react-color';

import PropTypes from '../../lib/PropTypes';


export default function FormColor(props) {
  const {
    label,
    value: color,
    effect,
  } = props;

  const [value, setValue] = useState(color || '');

  useEffect(() => {
    effect(value);
  });

  const updateColor = (res) => {
    setValue(res.hex);
  };
  return (
    <FormGroup>
      <Col><Label key="label-key" className="form-control-label">{label}</Label></Col>
      <Col>
        <HuePicker
          color={value}
          onChangeComplete={updateColor}
        />
      </Col>
    </FormGroup>
  );
}

FormColor.propTypes = {
  label: PropTypes.string,
  effect: PropTypes.func,
  value: PropTypes.string,
};

FormColor.defaultProps = {
  effect: () => {},
};
