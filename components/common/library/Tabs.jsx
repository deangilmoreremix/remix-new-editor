import React from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

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
              'library__tab-active': activeTab === item,
            })}
          onClick={() => setActiveTab(item)}
          key={item}
        >
          <SVGInline
            className={classnames('tab-icon', { 'tab-icon-active': activeTab === item })}
            classSuffix=""
            svg={tabItems[item].icon}
            cleanup={['title']}
            component="button"
          />
          <span>{tabItems[item].label}</span>
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
