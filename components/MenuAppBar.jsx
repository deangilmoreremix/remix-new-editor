import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import MenuItem from '@material-ui/core/MenuItem';
import Menu from '@material-ui/core/Menu';

import NavbarHamburger from './common/navbar/NavbarHamburger';
import PropTypes from '../lib/PropTypes';

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1,
  },
  menuButton: {
    marginRight: theme.spacing(2),
  },
  title: {
    flexGrow: 1,
  },
}));

function MenuAppBar(props) {
  const classes = useStyles();
  const {
    open,
    openMenu,
    closeMenu,
    anchorEl,
    items,
    onSave,
  } = props;

  return (
    <div className={`${classes.root} container-header`}>
      <AppBar position="static">
        <Toolbar className="container-menu">
          <div className="container-left-bar">
            <NavbarHamburger />
            <Typography variant="h6" className={classes.title}>
              VIDEOREMIX
            </Typography>
            <div className="container-nav">
              <div className="container-nav-undo">
                <img src="#" alt="" />
                <span>undo</span>
              </div>
              <div className="container-nav-redo">
                <img src="#" alt="" />
                <span>redo</span>
              </div>
              <div className="container-nav-save">
                <img src="#" alt="" />
                <button onClick={onSave}>save</button>
              </div>
            </div>
          </div>
          <div>
            <span
              onClick={openMenu}
              style={{ cursor: 'pointer' }}
            >
            Hi, Alex
            </span>
            <Menu
              className="header-menu"
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={open}
              onClose={closeMenu}
            >
              {items.map(item => (<MenuItem key={item.title} onClick={closeMenu}>{item.title}</MenuItem>))}
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
    </div>
  );
}

MenuAppBar.propTypes = {
  open: PropTypes.bool.isRequired,
  openMenu: PropTypes.func,
  closeMenu: PropTypes.func,
  anchorEl: PropTypes.element,
  onSave: PropTypes.func,
  items: PropTypes.arrayOf(PropTypes.shape({
    title: PropTypes.string,
  })),
};

MenuAppBar.defaultProps = {
  openMenu: () => {},
  closeMenu: () => {},
  onSave: () => {},
  items: [{ title: 'Profile' }, { title: 'Settings' }, { title: 'Log out' }],
};

export default MenuAppBar;
