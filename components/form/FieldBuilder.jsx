import React from 'react';

import PropTypes from '../../lib/PropTypes';
import { INPUT, INPUT_ELEMENTS } from '../../lib/constants/forms';

const FieldBuilder = ({ onChange, value, ...props }) => {
  const { name, type } = props;

  const handleChangeField = val => {
    onChange({ [name]: val });
  };

  const InputComponent = React.useMemo(() => {
    if (INPUT_ELEMENTS[type]) {
      return INPUT_ELEMENTS[type];
    }
    return INPUT_ELEMENTS[INPUT];
  }, []);

  return (
    <InputComponent {...props} value={value} onChange={handleChangeField} />
  );
};

FieldBuilder.propTypes = {
  type: PropTypes.string,
  onChange: PropTypes.func,
  name: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default FieldBuilder;
