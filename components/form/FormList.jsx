import React, { useState, useEffect } from 'react';
import { action, isObservableArray, observable, computed } from 'mobx';
import { FormGroup, Label, Col, Button, Popover, Container } from 'reactstrap';
import PropTypes from '../../lib/PropTypes';
import FormTextField from './FormTextField';
// todo check ListGroupItemHeading

export default function FormList(props) {
  const {
    label,
    values: defaultValues,
    effect,
  } = props;


  const [values, setValues] = useState(defaultValues || []);

  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    effect(values);
  }, [effect, values]);

  const onEnter = (v) => {
    v.trim();
    if (!values.some(item => item === v)) {
      setValues([...values, v]);
    }
    setNewValue('');
  };

  const handleRemove = (v) => {
    const newValues = values.filter(item => item !== v);
    setValues(newValues);
  };

  return (
    <FormGroup>
      <Label key="label-key" className="form-control-label">{label}</Label>
      <div key="multiselect-key">
        <div>
          <ul>
            {values.map((item) => (
              <li key={`${item}-item-key`}>
                {item}
                {' '}
                <Button onClick={() => handleRemove(item)}>x</Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Col>
        <FormTextField
            // onChange={this.checkEmail}
          value={newValue}
          onEnter={onEnter}
        />
      </Col>
    </FormGroup>
  );
}

FormList.propTypes = {
  label: PropTypes.string,
  values: PropTypes.arrayOrObservableArray,
  effect: PropTypes.func,
};

FormList.defaultProps = {
  values: [],
  effect: () => {},
};
