import React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import { Grid, AppBar, Toolbar } from '@material-ui/core';

import Menu from './common/Menu';
import UserBox from './common/user/UserBox';

import outIcon from '../public/static/svgImages/header/out.svg';
import logoIcon from '../public/static/svgImages/header/logo.svg';
import redoIcon from '../public/static/svgImages/header/redo.svg';
import undoIcon from '../public/static/svgImages/header/undo.svg';
import saveIcon from '../public/static/svgImages/header/save.svg';
import folderIcon from '../public/static/svgImages/header/folder.svg';
import hamburgerIcon from '../public/static/svgImages/header/hamburger.svg';
import collaborateIcon from '../public/static/svgImages/header/collaborate.svg';

import useProjectStore from './hooks/useProjectStore';


const userMenu = [
  { title: 'My Projects', icon: folderIcon },
  { title: 'Sign Out', icon: outIcon },
  { title: 'Collaborate', icon: collaborateIcon },
];

const projectMenu = [
  { title: 'New a project...' },
  { title: 'Make a copy' },
  { title: 'Rename project' },
  { title: 'Finish project' },
  { title: 'Move to trash' },
  { title: 'Close project' },
];

const MenuAppBar = observer(() => {
  const anchorRef = React.useRef(null);
  const projectStore = useProjectStore();

  const { save, modified } = projectStore;

  return (
    <div className="container-header" ref={anchorRef}>
      <AppBar position="static" className="app-bar">
        <Toolbar className="container-menu">
          <Grid container>
            <Grid item xs={1} className="flex-vertical-center">
              <Menu
                toggleElement={
                  (
                    <SVGInline
                      className="icon icon-button"
                      classSuffix=""
                      svg={hamburgerIcon}
                      cleanup={['title']}
                    />
                  )}
                items={projectMenu}
                className="project-menu"
                parent={anchorRef}
                placement="bottom-start"
              />
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
                  disabled={!modified}
                />
                <button
                  className={`icon-button ${modified ? 'active-save' : ''}`}
                  onClick={() => save()}
                  disabled={!modified}
                >
                  save
                </button>
              </div>
            </Grid>
            <Grid item xs={6} />
            <Grid item xs={2}>
              <Menu
                toggleElement={<UserBox />}
                items={userMenu}
                className="user-menu flex-center"
                needEndIcon
              />
            </Grid>
          </Grid>
        </Toolbar>
      </AppBar>
    </div>
  );
});

export default MenuAppBar;
