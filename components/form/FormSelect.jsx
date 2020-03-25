import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import InputLabel from '@material-ui/core/InputLabel';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const FormSelect = props => {
  const {
    items,
    label,
    onChange,
    value,
    minWidth,
    labelWidth,
    componentClasses: {
      containerClass,
      labelClass,
      selectClass,
      itemClass,
    },
  } = props;

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

  const handleChange = event => {
    onChange(event.target.value);
  };

  return (
    <div className={classnames(containerClass)}>
      <FormControl variant="outlined" className={classes.formControl}>
        <InputLabel
          className={classnames(labelClass)}
          id="demo-simple-select-outlined-label"
        >
          {label}
        </InputLabel>
        <Select
          className={classnames(selectClass)}
          labelId="demo-simple-select-outlined-label"
          id="demo-simple-select-outlined"
          value={value}
          onChange={handleChange}
          labelWidth={labelWidth}
        >
          {items.map(item => (
            <MenuItem
              key={item.value}
              className={classnames(itemClass)}
              value={item.value}
            >
              {item.value}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
};

FormSelect.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
  })).isRequired,
  componentClasses: PropTypes.objectOf(PropTypes.shape({
    containerClass: PropTypes.string,
    labelClass: PropTypes.string,
    selectClass: PropTypes.string,
    itemClass: PropTypes.string,
  })),
  value: PropTypes.string,
  label: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  minWidth: PropTypes.number,
  labelWidth: PropTypes.number,
};

FormSelect.defaultProps = {
  label: 'label',
  minWidth: 100,
  labelWidth: 40,
  componentClasses: {},
};

export default FormSelect;
