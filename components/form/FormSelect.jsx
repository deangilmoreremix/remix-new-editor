import React, { useState, useEffect, useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';

import PropTypes from '../../lib/PropTypes';

function FormSelect(props) {
  const { items, label, onChange, value, minWidth } = props;

  const useStyles = makeStyles(theme => ({
    formControl: {
      margin: theme.spacing(1),
      minWidth,
    },
    selectEmpty: {
      marginTop: theme.spacing(2),
    },
  }));

  const classes = useStyles(minWidth);

  const inputLabel = useRef(null);
  const [labelWidth, setLabelWidth] = useState(0);
  useEffect(() => {
    setLabelWidth(inputLabel.current.offsetWidth);
  }, []);

  const handleChange = event => {
    onChange(event.target.value);
  };

  return (
    <div className="form-container">
      <FormControl variant="outlined" className={classes.formControl}>
        <InputLabel
          className="form-select"
          ref={inputLabel}
          id="demo-simple-select-outlined-label"
        >
          {label}
        </InputLabel>
        <Select
          className="form-list"
          labelId="demo-simple-select-outlined-label"
          id="demo-simple-select-outlined"
          value={value}
          onChange={handleChange}
          labelWidth={labelWidth}
        >
          {items.map(item => (
            <MenuItem key={item.value} className="select-item" value={item.value}>{item.value}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
}

FormSelect.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
  })).isRequired,
  value: PropTypes.string.isRequired,
  label: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  minWidth: PropTypes.number,
};

FormSelect.defaultProps = {
  label: 'label',
  minWidth: 100,

};

export default FormSelect;
