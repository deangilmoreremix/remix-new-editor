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
    className,
    labelClassName,
    selectClassName,
  } = props;

  // eslint-disable-next-line no-shadow
  const handleChange = ({ value }) => {
    onChange(value);
  };

  return (
    <FormGroup className={className}>
      <Box>
        {
          label && (
            <InputLabel
              className={classnames(labelClassName)}
            >
              {label}
            </InputLabel>
          )
        }
        <Select
          className={classnames('select-element', selectClassName)}
          classNamePrefix="select"
          defaultValue={value}
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
    label: PropTypes.string.isRequired,
  })).isRequired,
  labelClassName: PropTypes.string,
  selectClassName: PropTypes.string,
  className: PropTypes.string,
  value: PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  }),
  label: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

FormSelect.defaultProps = {
  labelClassName: 'select-label-top',
};

export default FormSelect;
