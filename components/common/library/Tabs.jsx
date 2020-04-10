import React from 'react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';
import { tabItems } from '../../../lib/constants/library';

const Tabs = ({ setActiveTab, activeTab }) => (
  <div className="library__tabs">
    {
      tabItems && Object.keys(tabItems).map(item => (
        <button
          type="button"
          className={classnames(
            'library__tab',
            {
              'library__tab-active': activeTab && activeTab === item,
            })}
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
  activeTab: PropTypes.string.isRequired,
};

export default Tabs;
