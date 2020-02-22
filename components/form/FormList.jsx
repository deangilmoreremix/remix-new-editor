import React, { useState, useEffect } from 'react';
import { FormGroup, Label, Col, Button } from 'reactstrap';

import FormTextField from './FormTextField';

import PropTypes from '../../lib/PropTypes';


export default function FormList(props) {
  const {
    label,
    onChange,
    values: defaultValues,
  } = props;


  const [values, setValues] = useState(defaultValues || []);

  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    onChange(values);
  }, [onChange, values]);

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
          value={newValue}
          onEnter={onEnter}
        />
      </Col>
    </FormGroup>
  );
}

FormList.propTypes = {
  onChange: PropTypes.func,
  label: PropTypes.string,
  values: PropTypes.arrayOrObservableArray,
};

FormList.defaultProps = {
  values: [],
  onChange: () => {},
};
