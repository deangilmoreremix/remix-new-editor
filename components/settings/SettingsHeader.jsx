import * as React from 'react';
import classnames from 'classnames';
import { Paper, Tab, Tabs } from '@material-ui/core';

import PropTypes from '../../lib/PropTypes';

const SettingsHeader = ({ className, tabs, setTab, activeTab }) => {
  const handleChange = (event, newValue) => {
    if (setTab) {
      return setTab(newValue);
    }
    return null;
  };

  return (
    <Paper square className={classnames(className, 'header-tabs')}>
      <Tabs
        value={activeTab}
        indicatorColor="primary"
        textColor="primary"
        onChange={handleChange}
      >
        {tabs && tabs.map(({ label, disabled }) => (
          <Tab
            key={label}
            label={label}
            disabled={disabled}
          />
        ))}
      </Tabs>
    </Paper>
  );
};

SettingsHeader.propTypes = {
  activeTab: PropTypes.number.isRequired,
  className: PropTypes.string,
  setTab: PropTypes.func,
  tabs: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string,
    disabled: PropTypes.bool,
  })).isRequired,
};

export default SettingsHeader;
