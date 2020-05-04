import React from 'react';

import PropTypes from '../../lib/PropTypes';
import { INPUT, INPUT_ELEMENTS } from '../../lib/constants/forms';

const FieldBuilder = React.forwardRef(({ onChange, value, ...props }, ref) => {
  const { name, type } = props;

  const handleChangeField = (val, options) => {
    onChange({ [name]: val }, options);
  };

  const InputComponent = React.useMemo(() => {
    if (INPUT_ELEMENTS[type]) {
      return INPUT_ELEMENTS[type];
    }
    return INPUT_ELEMENTS[INPUT];
  }, [type]);

  return (
    <InputComponent
      {...props}
      value={value}
      onChange={handleChangeField}
      ref={ref}
    />
  );
});

FieldBuilder.propTypes = {
  type: PropTypes.string,
  onChange: PropTypes.func,
  name: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.bool,
    PropTypes.array,
    PropTypes.shape(),
  ]),
};

export default FieldBuilder;
