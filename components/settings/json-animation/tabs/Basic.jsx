import * as React from 'react';

import PropTypes from '../../../../lib/PropTypes';
import FieldBuilder from '../../../form/FieldBuilder';

const Basic = ({ options, fields, ...props }) => (
  <div>
    {fields && Object.keys(fields).map(key => {
      const { label, type } = fields[key];
      return (
        <FieldBuilder
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
      label: PropTypes.number,
    }),
  ),
};

export default Basic;
