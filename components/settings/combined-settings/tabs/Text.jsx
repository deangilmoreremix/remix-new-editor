import React from 'react';

import CombinedText from '../components/CombinedText';
import PropTypes from '../../../../lib/PropTypes';

const Text = ({ values, onChange, element: elementData }) => (
  <CombinedText
    {...values}
    onChange={newData => onChange({ ...newData, combinedItemId: values.id })}
    combinedId={elementData.id}
  />
);

Text.propTypes = {
  values: PropTypes.shape().isRequired,
  element: PropTypes.shape().isRequired,
  onChange: PropTypes.func.isRequired,
};

export default Text;
