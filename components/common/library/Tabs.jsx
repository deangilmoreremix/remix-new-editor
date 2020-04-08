import React from 'react';

import PropTypes from '../../../lib/PropTypes';
import { tabItems } from '../../../lib/constants/library';

const Tabs = ({ setActiveTab }) => (
  <div className="library__tabs">
    {
      tabItems && Object.keys(tabItems).map(item => (
        <button
          type="button"
          className="library__tab"
          onClick={() => setActiveTab(item)}
          key={item}
        >
          {`Add ${tabItems[item].label}`}
        </button>
      ))
    }
  </div>
);

Tabs.propTypes = {
  setActiveTab: PropTypes.func.isRequired,
};

export default Tabs;
