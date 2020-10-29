import React from 'react';
import InputLabel from '@material-ui/core/InputLabel';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';
import HelpIconComponent from '../common/HelpIcon';

const FormCheckboxField = (props) => {
  const {
    onChange,
    value,
    disabled,
    label,
    floatClassName,
    tooltipHeight,
    tooltipMessage,
    isTooltip,
  } = props;

  const onClick = () => {
    onChange(!value);
  };

  return (
    <div className={classnames('checkbox-element', floatClassName)}>
      <Button disableripple="true" onClick={onClick}>
        <InputLabel className="form-control-label">
          {label}
        </InputLabel>
        {isTooltip && (
          <HelpIconComponent height={tooltipHeight} message={tooltipMessage} />
        )}
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
  tooltipHeight: PropTypes.number,
  tooltipMessage: PropTypes.string,
  isTooltip: PropTypes.bool,
};

FormCheckboxField.defaultProps = {
  disabled: false,
  onChange: () => {},
};

export default FormCheckboxField;
