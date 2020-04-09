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
    containerClass,
    labelClass,
    selectClass,
    itemClass,
  } = props;

  console.log('select')

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
    <div className={classnames(containerClass, 'container-select')}>
      <FormControl variant="outlined" className={classes.formControl}>
        {label && (
          <InputLabel
            className={classnames(labelClass, 'label-select')}
            id="demo-simple-select-outlined-label"
          >
            {label}
          </InputLabel>
        )}
        <Select
          className={classnames(selectClass, 'list-items')}
          labelId="demo-simple-select-outlined-label"
          id="demo-simple-select-outlined"
          value={value}
          onChange={handleChange}
          labelWidth={labelWidth}
        >
          {items.map(item => (
            <MenuItem
              key={item}
              className={classnames(itemClass, 'input-select')}
              value={item}
            >
              {item}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
};

FormSelect.propTypes = {
  items: PropTypes.arrayOrObservableArrayOf(PropTypes.string),
  containerClass: PropTypes.string,
  labelClass: PropTypes.string,
  selectClass: PropTypes.string,
  itemClass: PropTypes.string,
  value: PropTypes.string,
  label: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  minWidth: PropTypes.number,
  labelWidth: PropTypes.number,
};

FormSelect.defaultProps = {
  minWidth: 100,
  labelWidth: 40,
};

export default FormSelect;
