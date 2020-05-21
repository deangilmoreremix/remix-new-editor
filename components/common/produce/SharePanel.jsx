import * as React from 'react';
import PropTypes from '../../../lib/PropTypes';

const SharePanel = ({ items }) => (
  <div>
    {items.map(({ label, action }) => (
      <button type="button" key={label} onClick={action}>
        {label}
      </button>
    ))}
  </div>
);

SharePanel.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    action: PropTypes.func.isRequired,
  })).isRequired,
};

export default SharePanel;
