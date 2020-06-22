import * as React from 'react';
import classnames from 'classnames';

import PropTypes from '../../lib/PropTypes';

const SettingsHeader = ({ className, tabs, setTab, activeTab, title }) => {
  const handleChange = React.useCallback((newValue) => {
    if (newValue === activeTab) {
      return;
    }
    if (setTab) {
      return setTab(newValue);
    }
    return null;
  }, [activeTab]);

  return (
    <div className={classnames(className, 'header-tabs')}>
      {
        title && <p className="header-tabs__title">{title}</p>
      }
      {
        tabs && tabs[activeTab] && tabs.map((tab, i) => (
          <button
            key={tab.label}
            type="button"
            className={classnames('header-tabs__item', { 'header-tabs__item--active': activeTab === i })}
            onClick={() => handleChange(i)}
            disabled={tab.disabled}
          >
            {tab.label}
          </button>
        ))
      }
    </div>
  );
};

SettingsHeader.propTypes = {
  activeTab: PropTypes.number,
  className: PropTypes.string,
  setTab: PropTypes.func,
  tabs: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string,
    disabled: PropTypes.bool,
    requiredFeature: PropTypes.string,
  })),
  title: PropTypes.string,
};

export default SettingsHeader;
