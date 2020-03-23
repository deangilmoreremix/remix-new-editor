import React, { useEffect, useRef, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Input from '@material-ui/core/Input';
import Rotate from '../../lib/utils/rotate';

import PropTypes from '../../lib/PropTypes';
import FormTextField from './FormTextField';

const useStyles = makeStyles(() => ({
  angleInput: {
    border: '1px solid #999999',
    width: '54px',
    height: '34px',
    padding: '9px',
    borderRadius: '3px',
    color: '#fff',
    fontSize: '14px',
  },
}));

const FormAngle = ({ name, onChange, value = 0 }) => {
  const [angle, setAngle] = useState(value);
  const [formAngle, setFormAngle] = useState();
  const handleRotate = useRef();
  const classes = useStyles();

  useEffect(() => {
    const item = new Rotate(handleRotate.current, angle, setAngle);
    item.start();
    setFormAngle(item);
    return () => {
      item.delete();
    };
  }, []);

  useEffect(() => {
    if (onChange) {
      onChange(angle);
    }
  }, [angle, onChange]);

  const onInputChange = (e) => {
    formAngle.delete();
    const item = new Rotate(handleRotate.current, e.target.value, setAngle);
    item.start();
    setFormAngle(item);
    setAngle(e.target.value);
  };

  return (
    <div className="form-angle">
      <div className="angle-circle">
        <span className="angle-circle__line" ref={handleRotate} />
      </div>
      <Input
        className={classes.angleInput}
        variant="outlined"
        name={name}
        onChange={onInputChange}
        type="text"
        value={angle}
      />
      <FormTextField
        inputType="number"
        onChange={onInputChange}
        value={angle}
      />
    </div>
  );
};

FormAngle.propTypes = {
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.numbers,
};

export default FormAngle;
