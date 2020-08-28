import React, { useEffect, useState } from 'react';
import classnames from 'classnames';
import moment from 'moment';
import NumberFormat from 'react-number-format';

import { ENTER_KEY } from '../../lib/constants/keyCodes';
import PropTypes from '../../lib/PropTypes';
import { TIME_DISPLAY_FORMAT } from '../../lib/constants/formats';
import { MAX_DURATION } from '../../lib/constants/project';

const DEFAULT_TIME_VALUE = '00:00:00';

const TimeInput = ({
  name,
  label,
  onChange,
  disabled,
  inputClassName,
  labelClassName,
  className,
  placeholder,
  value,
  min,
  max,
}) => {
  const conditionalProps = {};
  const [newValue, setValue] = useState(value);

  useEffect(() => {
    setValue(value);
  }, [value]);

  conditionalProps.onKeyPress = ({ which }) => {
    if (which === ENTER_KEY) {
      onChange(newValue);
    }
  };

  const onEdit = ({ formattedValue }) => {
    const validValue = `${formattedValue
      .substring(0, 1).replace(/[6-9]/, 5)
    + formattedValue.substring(1, 2)}:${
      +formattedValue.substring(3, 4).replace(/[6-9]/, 5)
    }${formattedValue.substring(4, 8)}`;

    const time = moment(validValue, TIME_DISPLAY_FORMAT);
    const diffTime = moment({ minutes: 0, seconds: 0 });
    const seconds = moment.duration(time.diff(diffTime)).asSeconds();

    if ((Math.ceil(value * 100) / 100) !== seconds && seconds >= min && seconds <= max) {
      setValue(seconds);
    }
  };

  const formattedValue = seconds => {
    if (!seconds) {
      return DEFAULT_TIME_VALUE;
    }

    const duration = moment.duration({ seconds });
    return moment({ minutes: 0, seconds: 0 }).add(duration).format(TIME_DISPLAY_FORMAT);
  };

  return (
    <div className={classnames(className)}>
      <label htmlFor={name} className={classnames(labelClassName)}>{label}</label>
      <NumberFormat
        placeholder={placeholder}
        disabled={disabled}
        format="##:##.##"
        displayType="input"
        name={name}
        id={name}
        onValueChange={onEdit}
        className={classnames('time-input input-field', inputClassName)}
        value={formattedValue(newValue)}
        type="tel"
        allowNegative={false}
        onBlur={() => onChange(newValue)}
        {...conditionalProps}
      />
    </div>
  );
};

TimeInput.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({})]),
  min: PropTypes.number,
  max: PropTypes.number,
  onChange: PropTypes.func.isRequired,
};

TimeInput.defaultProps = {
  label: '',
  disabled: false,
  min: 0,
  max: MAX_DURATION,
};

export default TimeInput;
