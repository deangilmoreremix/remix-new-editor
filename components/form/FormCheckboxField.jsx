import React from 'react';
import InputLabel from '@material-ui/core/InputLabel';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const FormCheckboxField = (props) => {
  const { onChange, value, disabled, label, floatClassName } = props;

  const onClick = () => {
    onChange(!value);
  };

  return (
    <div className={classnames('checkbox-element', floatClassName)}>
      <Button disableripple="true" onClick={onClick}>
        <InputLabel className="form-control-label">
          {label}
        </InputLabel>
      </Button>
      <Checkbox
        disabled={disabled}
        checked={value}
        onClick={onClick}
        disableripple="true"
        classes={{ root: classnames('checkmark', value ? 'checked' : 'unchecked') }}
      />
    </div>
  );
};

FormCheckboxField.propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.bool,
  disabled: PropTypes.bool,
  label: PropTypes.string,
  floatClassName: PropTypes.string,
};

FormCheckboxField.defaultProps = {
  disabled: false,
  onChange: () => {},
};

export default FormCheckboxField;
