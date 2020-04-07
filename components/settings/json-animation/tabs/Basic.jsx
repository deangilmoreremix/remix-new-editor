import * as React from 'react';

import PropTypes from '../../../../lib/PropTypes';
import { BASIC_FIELDS } from '../../../../lib/constants/settings/json-animation';
import FieldBuilder from '../../../form/FieldBuilder';

const Basic = ({ options, ...props }) => (
  <div>
    {Object.keys(BASIC_FIELDS).map(key => {
      const { label, type } = BASIC_FIELDS[key];
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
};

export default Basic;
