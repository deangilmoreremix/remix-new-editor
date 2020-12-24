import React from 'react';
import Select from 'react-select';
import makeAnimated from 'react-select/animated';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const animatedComponents = makeAnimated();

const MultipleFormSelect = (
  {
    items,
    onChange,
    label,
    isDisabled = false,
    defaultValue,
    name,
  }) => (
    <div className={classnames('multiple-select-container', { 'button-disabled': isDisabled })}>
      <p className="multiple-select-label">{label}</p>
      <Select
        placeholder="Select categories..."
        classNamePrefix="multiple"
        className="multiple-select"
        closeMenuOnSelect={false}
        components={animatedComponents}
        defaultValue={defaultValue}
        isMulti
        options={items}
        onChange={onChange}
        isDisabled={isDisabled}
        name={name}
      />
    </div>
);

MultipleFormSelect.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
    label: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
  })).isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  isDisabled: PropTypes.bool,
  name: PropTypes.string,
  defaultValue: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),
    label: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]),
  })),
};

export default MultipleFormSelect;
