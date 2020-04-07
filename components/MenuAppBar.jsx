import React from 'react';
import { observer } from 'mobx-react';
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
import hamburgerIcon from '../public/static/svgImages/header/hamburger.svg';
import useProjectStore from './hooks/useProjectStore';

// const useStyles = makeStyles(theme => ({
//   root: {
//     flexGrow: 1,
//   },
//   menuButton: {
//     marginRight: theme.spacing(2),
//   },
//   title: {
//     flexGrow: 1,
//   },
// }));

const items = [
  { title: 'My Projects', icon: folderIcon },
  { title: 'Sign Out', icon: outIcon },
  { title: 'Collaborate', icon: collaborateIcon },
];

const MenuAppBar = observer(() => {
  const projectStore = useProjectStore();

  const { save, modified } = projectStore;

  const anchorRef = React.useRef(null);
  const ToggleElement = () => (<UserBox />);

  const Nav = () => (
    <SVGInline
      className="icon icon-button"
      classSuffix=""
      svg={hamburgerIcon}
      cleanup={['title']}
      component="button"
    />
  );

  const items2 = [
    { title: 'New a project...' },
    { title: 'Make a copy' },
    { title: 'Rename project' },
    { title: 'Finish project' },
    { title: 'Move to trash' },
    { title: 'Close project' },
  ];

  return (
    <div className="container-header" ref={anchorRef}>
      <AppBar position="static" className="app-bar">
        <Toolbar className="container-menu">
          <Grid container>
            <Grid item xs={1} className="flex-vertical-center">
              <Menu toggleElement={Nav} items={items2} className="project-menu" parent={anchorRef} placement="bottom-start" />
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
                  className={`auto-margin icon icon-button ${modified ? 'active-save' : ''}`}
                  classSuffix=""
                  svg={saveIcon}
                  cleanup={['title']}
                  component="button"
                  onClick={() => save()}
                />
                <button className={`icon-button ${modified ? 'active-save' : ''}`} onClick={() => save()}>save</button>
              </div>
            </Grid>
            <Grid item xs={6} />
            <Grid item xs={2}>
              <Menu toggleElement={ToggleElement} items={items} className="user-menu flex-center" needEndIcon />
            </Grid>
          </Grid>
        </Toolbar>
      </AppBar>
    </div>
  );
});

export default MenuAppBar;
