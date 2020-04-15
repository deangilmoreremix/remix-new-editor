import React from 'react';
import InputLabel from '@material-ui/core/InputLabel';
import Select from 'react-select';
import classnames from 'classnames';
import FormGroup from '@material-ui/core/FormGroup';
import Box from '@material-ui/core/Box';
import PropTypes from '../../lib/PropTypes';

const FormSelect = props => {
  const {
    items,
    label,
    onChange,
    value,
    labelClassName,
    selectClassName,
  } = props;

  const handleChange = event => {
    onChange(event.value);
  };

  return (
    <FormGroup>
      <Box>
        <InputLabel
          className={classnames(labelClassName)}
        >
          {label}
        </InputLabel>
        <Select
          className={classnames('select-element', selectClassName)}
          classNamePrefix="select"
          value={value}
          onChange={handleChange}
          options={items}
        />
      </Box>
    </FormGroup>
  );
};

FormSelect.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
  })).isRequired,
  labelClassName: PropTypes.string,
  selectClassName: PropTypes.string,
  value: PropTypes.string,
  label: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

FormSelect.defaultProps = {
  label: 'label',
  labelClassName: 'select-label-top',
};

export default FormSelect;
