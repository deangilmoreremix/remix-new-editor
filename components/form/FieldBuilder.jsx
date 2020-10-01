import React from 'react';
import { observer } from 'mobx-react';

import PropTypes from '../../lib/PropTypes';
import { INPUT, INPUT_ELEMENTS } from '../../lib/constants/forms';
import HelpIconComponent from '../common/HelpIcon';

const FieldBuilder = React.forwardRef(({ onChange, value, ...props }, ref) => {
  const { name, type, isTooltip, tooltipMessage, tooltipHeight } = props;

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
    <>
      {isTooltip ? (
        <div className="settings-input-box">
          <HelpIconComponent height={tooltipHeight} message={tooltipMessage} />
          <InputComponent
            {...props}
            value={value}
            onChange={handleChangeField}
            ref={ref}
          />
        </div>
      ) : (
        <InputComponent
          {...props}
          value={value}
          onChange={handleChangeField}
          ref={ref}
        />
      )}
    </>
  );
});

FieldBuilder.propTypes = {
  type: PropTypes.string,
  onChange: PropTypes.func,
  name: PropTypes.string.isRequired,
  isTooltip: PropTypes.bool,
  tooltipHeight: PropTypes.number,
  tooltipMessage: PropTypes.string,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.bool,
    PropTypes.array,
    PropTypes.shape(),
  ]),
};

export default observer(FieldBuilder);
