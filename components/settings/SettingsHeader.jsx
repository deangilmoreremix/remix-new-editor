import * as React from 'react';
import Paper from '@material-ui/core/Paper';
import Tabs from '@material-ui/core/Tabs';
import classnames from 'classnames';
import Tab from '@material-ui/core/Tab';
// import makeStyles from '@material-ui/core/styles/makeStyles';

import PropTypes from '../../lib/PropTypes';
// import { COLORS } from '../../lib/constants/styles';

// const useStyles = makeStyles({
//   inactive: {
//     background: COLORS.headerTabInactive,
//   },
//   selected: {
//     background: COLORS.headerTabActive,
//   },
//   disabled: {
//     background: COLORS.headerTabDisabled,
//   },
// });

const SettingsHeader = ({ className, tabs, setTab, activeTab }) => {
  console.log('tabs', tabs)
  // const classes = useStyles();

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
        // classes={classes}
      >
        {tabs && tabs.map(({ label, disabled }) => (
          <Tab
            // disableRipple
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
  tabs: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default SettingsHeader;
