import React from 'react';
import PropTypes from '../../../lib/PropTypes';

const Tabs = ({ items, setActiveTub }) => (
  <div className="library__tabs">
    {
        Object.keys(items).length ? Object.keys(items).map(item => (
          <button
            type="button"
            className="library__tab"
            onClick={() => setActiveTub(item)}
            key={item}
          >
            {`Add ${items[item].text}`}
          </button>
        )) : null
      }
  </div>
);

Tabs.propTypes = {
  items: PropTypes.objectOf(
    PropTypes.shape({
      text: PropTypes.string.isRequired,
    }),
  ),
  setActiveTub: PropTypes.func.isRequired,
};

export default Tabs;
