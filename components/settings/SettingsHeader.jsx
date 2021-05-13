import * as React from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import CloseButton from '../common/CloseButton';

import PropTypes from '../../lib/PropTypes';

const SettingsHeader = ({
  className,
  tabs,
  setTab,
  activeTab,
  title,
  onCloseWindow,
  closeButton,
  handleClose,
  isExtendCloseButton,
  allowedMultiButton,
}) => {
  const handleChange = React.useCallback((newValue) => {
    if (newValue === activeTab) {
      return;
    }
    if (setTab) {
      return setTab(newValue);
    }
    return null;
  }, [activeTab, setTab]);

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
            {tab.icon && (
              <SVGInline
                className={classnames('tab-icon', { 'tab-icon-active': activeTab === i })}
                classSuffix=""
                svg={tabs[i].icon}
                cleanup={['title']}
              />
            )}
            {tab.label}
          </button>
        ))
      }
      {tabs && (
        <CloseButton
          allowedMultiButton={allowedMultiButton}
          className={isExtendCloseButton ? 'close-button-extend' : null}
          isTabs={tabs.length > 1}
          onClick={closeButton ? handleClose : onCloseWindow}
        />
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
    icon: PropTypes.string,
    disabled: PropTypes.bool,
    requiredFeature: PropTypes.string,
  })),
  title: PropTypes.string,
  closeButton: PropTypes.bool,
  handleClose: PropTypes.func,
  isExtendCloseButton: PropTypes.bool,
  allowedMultiButton: PropTypes.bool,
};

SettingsHeader.defaultProps = {
  closeButton: false,
};

export default SettingsHeader;
