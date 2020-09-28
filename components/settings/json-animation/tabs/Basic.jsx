import * as React from 'react';

import PropTypes from '../../../../lib/PropTypes';
import FieldBuilder from '../../../form/FieldBuilder';

const Basic = ({ options, fields, element, ...props }) => (
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
          element={element}
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
  element: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
    popcornOptions: PropTypes.shape().isRequired,
    track: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number,
    ]).isRequired,
  }).isRequired,
};

export default Basic;
