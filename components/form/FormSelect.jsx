import React from 'react';
import InputLabel from '@material-ui/core/InputLabel';
import Select from 'react-select';
import classnames from 'classnames';
import FormGroup from '@material-ui/core/FormGroup';
import Box from '@material-ui/core/Box';
import PropTypes from '../../lib/PropTypes';

import { FONT_FAMILY } from '../../lib/constants/popcorn';

const FormSelect = React.forwardRef((props, ref) => {
  const {
    items,
    label,
    onChange,
    dataIsRequired,
    value,
    className,
    labelClassName,
    selectClassName,
    disabled,
    menuPlacement,
    menuPosition,
    ...rest
  } = props;

  const handleChange = data => {
    onChange(dataIsRequired ? data : data.value);
  };

  const fontFamily = {
    option: (styles, { data }) => ({
      ...styles,
      fontFamily: data.value,
    }),
  };

  return (
    <FormGroup className={classnames(className, { 'select-element-disabled': disabled })}>
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
          ref={ref}
          className={classnames('select-element', selectClassName)}
          classNamePrefix="select"
          defaultValue={items.find(item => item.value === value)}
          onChange={handleChange}
          options={items}
          value={items.find(i => i.value === value)}
          styles={rest.name === FONT_FAMILY && fontFamily}
          isDisabled={disabled}
          menuPlacement={menuPlacement}
          maxMenuHeight={400}
          menuPosition={menuPosition}
          {...rest}
        />
      </Box>
    </FormGroup>
  );
});

FormSelect.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
  })).isRequired,
  labelClassName: PropTypes.string,
  selectClassName: PropTypes.string,
  className: PropTypes.string,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  label: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  dataIsRequired: PropTypes.bool,
  disabled: PropTypes.bool,
};

FormSelect.defaultProps = {
  labelClassName: 'select-label-top',
  disabled: false,
  dataIsRequired: false,
};

export default FormSelect;
