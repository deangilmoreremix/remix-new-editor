// TODO: should be removed after a new component is created instead this one
import React, { useState } from 'react';

import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import FormGroup from '@material-ui/core/FormGroup';
import FormLabel from '@material-ui/core/FormLabel';

import FormTextField from './FormTextField';

import PropTypes from '../../lib/PropTypes';


export default function FormList(props) {
  const {
    label,
    onChange,
    values,
  } = props;

  const [newValue, setNewValue] = useState('');

  const onEnter = (v) => {
    v.trim();
    if (!values.some(item => item === v)) {
      onChange([...values, v]);
    }
    setNewValue('');
  };

  const onEdit = (v) => {
    setNewValue(v);
  };

  const handleRemove = (v) => {
    const newValues = values.filter(item => item !== v);
    onChange(newValues);
  };

  return (
    <FormGroup>
      <FormLabel key="label-key" className="form-control-label">{label}</FormLabel>
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
      <Box>
        <FormTextField
          value={newValue}
          onEnter={onEnter}
          onChange={onEdit}
        />
      </Box>
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
