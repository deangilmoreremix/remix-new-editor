import React from 'react';
import SVGInline from 'react-svg-inline';
import { makeStyles } from '@material-ui/core/styles';
import { Grid, AppBar } from '@material-ui/core';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import MenuItem from '@material-ui/core/MenuItem';

import NavbarHamburger from './common/navbar/NavbarHamburger';
import UserBox from './common/user/UserBox';
import Menu from './common/Menu';
import PropTypes from '../lib/PropTypes';

import outIcon from '../public/static/svgImages/header/out.svg';
import logoIcon from '../public/static/svgImages/header/logo.svg';
import redoIcon from '../public/static/svgImages/header/redo.svg';
import undoIcon from '../public/static/svgImages/header/undo.svg';
import saveIcon from '../public/static/svgImages/header/save.svg';
import folderIcon from '../public/static/svgImages/header/folder.svg';
import collaborateIcon from '../public/static/svgImages/header/collaborate.svg';

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
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
  },
  drawer: {
    width: 250,
    flexShrink: 0,
  },
}));

const items = [
  { title: 'My Projects', icon: folderIcon },
  { title: 'Sign Out', icon: outIcon },
  { title: 'Collaborate', icon: collaborateIcon },
];

function MenuAppBar(props) {
  const classes = useStyles();
  const {
    open,
    openMenu,
    closeMenu,
    anchorEl,
    onSave,
  } = props;

  const ToggleElement = () => (<UserBox />);

  return (
    <div className={`${classes.root} container-header`}>
      <AppBar position="static" className={classes.appBar}>
        <Toolbar className="container-menu">
          <Grid container>
            <Grid item xs={1} className="flex-vertical-center">
              <NavbarHamburger classes={classes} />
            </Grid>
            <Grid item xs={2} className="flex-vertical-center">
              <SVGInline
                className="logo flex"
                classSuffix=""
                svg={logoIcon}
                cleanup={['title']}
              />
            </Grid>
            <Grid item xs={1} className="flex-vertical-center">
              <div className="auto-margin">
                <SVGInline
                  className="auto-margin icon icon-button"
                  classSuffix=""
                  svg={undoIcon}
                  cleanup={['title']}
                  component="button"
                />
                <button className="icon-button">undo</button>
              </div>
              <div className="auto-margin">
                <SVGInline
                  className="auto-margin icon icon-button"
                  classSuffix=""
                  svg={redoIcon}
                  cleanup={['title']}
                  component="button"
                />
                <button className="icon-button">redo</button>
              </div>
              <div className="auto-margin">
                <SVGInline
                  className="auto-margin icon icon-button"
                  classSuffix=""
                  svg={saveIcon}
                  cleanup={['title']}
                  component="button"
                />
                <button className="icon-button">save</button>
              </div>
            </Grid>
            <Grid item xs={6} />
            <Grid item xs={2}>
              <Menu toggleElement={ToggleElement} items={items} className="user-menu flex-center" />
            </Grid>
          </Grid>
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
};

MenuAppBar.defaultProps = {
  openMenu: () => {},
  closeMenu: () => {},
  onSave: () => {},
};

export default MenuAppBar;
