import React from 'react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';
import { JSON_TRANSITION_TABS } from '../../../lib/constants/jsonTransition';

const Tabs = ({ activeTab }) => (
  <div className="overlay__tabs">
    {
      JSON_TRANSITION_TABS && Object.keys(JSON_TRANSITION_TABS).map(item => (
        <button
          type="button"
          className={classnames(
            'overlay__tab',
            {
              'overlay__tab-active': activeTab === item,
            })}
          key={item}
          disabled
        >
          {item}
        </button>
      ))
    }
  </div>
);

Tabs.propTypes = {
  activeTab: PropTypes.string.isRequired,
};

export default Tabs;
