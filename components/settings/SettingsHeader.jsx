import * as React from 'react';
import classnames from 'classnames';
import CloseButton from '../common/CloseButton';

import PropTypes from '../../lib/PropTypes';

const SettingsHeader = ({
  className,
  tabs,
  setTab,
  activeTab,
  title,
  onCloseWindow,
  notCloseButton,
}) => {
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
      {tabs && !notCloseButton && (
        <CloseButton isTabs={tabs.length > 1} onClick={onCloseWindow} />
      )}
    </div>
  );
};

SettingsHeader.propTypes = {
  activeTab: PropTypes.number,
  className: PropTypes.string,
  setTab: PropTypes.func,
  onCloseWindow: PropTypes.func,
  tabs: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string,
    disabled: PropTypes.bool,
    requiredFeature: PropTypes.string,
  })),
  title: PropTypes.string,
  notCloseButton: PropTypes.bool,
};

SettingsHeader.defaultProps = {
  notCloseButton: false,
};

export default SettingsHeader;
