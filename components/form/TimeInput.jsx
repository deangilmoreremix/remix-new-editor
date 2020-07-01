import React from 'react';
import classnames from 'classnames';
import moment from 'moment';
import NumberFormat from 'react-number-format';

import PropTypes from '../../lib/PropTypes';
import { TIME_DISPLAY_FORMAT } from '../../lib/constants/formats';

const DEFAULT_TIME_VALUE = '0:00:00';

const TimeInput = ({
  name,
  label,
  onChange,
  onEnter,
  disabled,
  inputClassName,
  labelClassName,
  className,
  placeholder,
  value,
}) => {
  const conditionalProps = {};

  if (onEnter) {
    conditionalProps.onKeyPress = ({ which, target: { value: v } }) => {
      if (which === 13) {
        onEnter(v);
      }
    };
  }

  const onEdit = ({ formattedValue }) => {
    const time = moment(formattedValue, TIME_DISPLAY_FORMAT);
    const diffTime = moment({ minutes: 0, seconds: 0 });
    const newValue = moment.duration(time.diff(diffTime)).asSeconds();
    if (value !== newValue) {
      onChange(newValue);
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
        format="#:##.##"
        displayType="input"
        name={name}
        id={name}
        onValueChange={onEdit}
        className={classnames('time-input input-field', inputClassName)}
        value={formattedValue(value)}
        type="tel"
        allowNegative={false}
      />
    </div>
  );
};

TimeInput.propTypes = {
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  label: PropTypes.string,
  onEnter: PropTypes.func,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  inputClassName: PropTypes.string,
  labelClassName: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.shape({})]),
};

TimeInput.defaultProps = {
  label: '',
  disabled: false,
  onChange: () => {},
};

export default TimeInput;
