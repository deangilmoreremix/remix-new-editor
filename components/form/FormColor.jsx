// TODO: should be removed after a new component is created instead this one
import React from 'react';
import { HuePicker } from 'react-color';
import { Col, Label, FormGroup } from 'reactstrap';

import PropTypes from '../../lib/PropTypes';


export default function FormColor(props) {
  const {
    label,
    onChange,
    value: color,
  } = props;


  const updateColor = (res) => {
    onChange(res.hex);
  };
  return (
    <FormGroup>
      <Col><Label key="label-key" className="form-control-label">{label}</Label></Col>
      <Col>
        <HuePicker
          color={color}
          onChangeComplete={updateColor}
        />
      </Col>
    </FormGroup>
  );
}

FormColor.propTypes = {
  onChange: PropTypes.func,
  label: PropTypes.string,
  value: PropTypes.string,
};

FormColor.defaultProps = {
  onChange: () => {},
};
