import * as React from 'react';

import PropTypes from '../../../lib/PropTypes';
import FieldBuilder from '../../form/FieldBuilder';

const Basic = ({ options, fields, ...props }) => (
  // eslint-disable-next-line react/prop-types
  <div className={`inputs-${options.type}-wrapper`}>
    {fields && Object.keys(fields).map(key => {
      console.log(options.type, 24);
      const { label, type, ...fieldProps } = fields[key];
      return (
        <FieldBuilder
          {...fieldProps}
          {...props}
          label={label}
          type={type}
          value={options[key]}
          key={key}
          name={key}
        />
      );
    })}
  </div>
);

Basic.propTypes = {
  options: PropTypes.shape({}),
  onChange: PropTypes.func.isRequired,
  fields: PropTypes.objectOf(
    PropTypes.shape({
      type: PropTypes.string.isRequired,
      label: PropTypes.string,
    }),
  ),
};

export default Basic;
