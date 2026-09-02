import * as React from 'react';
import { Grid, Switch, Typography, withStyles } from '@material-ui/core';

import PropTypes from '../../lib/PropTypes';

const SmallSwitch = withStyles((theme) => ({
  root: {
    width: 28,
    height: 16,
    padding: 0,
    display: 'flex',
  },
  switchBase: {
    padding: 2,
    color: theme.palette.grey[500],
    '&$checked': {
      transform: 'translateX(12px)',
      color: theme.palette.common.white,
      '& + $track': {
        opacity: 1,
        backgroundColor: '#EB5054',
        borderColor: '#EB5054',
      },
    },
  },
  thumb: {
    width: 12,
    height: 12,
    boxShadow: 'none',
  },
  track: {
    border: `1px solid ${theme.palette.grey[500]}`,
    borderRadius: 16 / 2,
    opacity: 1,
    backgroundColor: theme.palette.common.white,
  },
  checked: {},
}))(Switch);

const Toggler = ({ label, checked, onChange }) => (
  <Typography component="div" className="on-off-switch">
    {label && <Typography className="on-off-switch-label" component="div">{label}</Typography>}
    <Grid className="on-off-switch-control" component="label" container alignItems="center" spacing={1}>
      <Grid item>Off</Grid>
      <Grid item>
        <SmallSwitch checked={checked} onChange={onChange} />
      </Grid>
      <Grid item>On</Grid>
    </Grid>
  </Typography>
);

Toggler.propTypes = {
  label: PropTypes.string,
  checked: PropTypes.bool,
  onChange: PropTypes.func,
};

export default Toggler;
