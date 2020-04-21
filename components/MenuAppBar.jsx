import React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import { Grid, AppBar, Toolbar } from '@material-ui/core';

import Menu from './common/Menu';
import UserBox from './common/user/UserBox';
import { SAVE_PROJECT_MODAL } from '../lib/constants/modals';

import outIcon from '../public/static/svgImages/header/out.svg';
import logoIcon from '../public/static/svgImages/header/logo.svg';
import redoIcon from '../public/static/svgImages/header/redo.svg';
import undoIcon from '../public/static/svgImages/header/undo.svg';
import saveIcon from '../public/static/svgImages/header/save.svg';
import folderIcon from '../public/static/svgImages/header/folder.svg';
import hamburgerIcon from '../public/static/svgImages/header/hamburger.svg';
import collaborateIcon from '../public/static/svgImages/header/collaborate.svg';
import newProjectIcon from '../public/static/svgImages/menu/new-project.svg';
import makeCopyIcon from '../public/static/svgImages/menu/make-copy.svg';
import renameProjectIcon from '../public/static/svgImages/menu/rename-project.svg';
import finishVideoIcon from '../public/static/svgImages/menu/finish-video.svg';
import trashIcon from '../public/static/svgImages/trash.svg';
import closeProjectIcon from '../public/static/svgImages/menu/close-project.svg';
import saveAsIcon from '../public/static/svgImages/menu/save-as.svg';

import useProjectStore from './hooks/useProjectStore';
import useUserStore from './hooks/useUserStore';
import useModalStore from './hooks/useModalStore';

import { showError } from '../lib/services/alertService';

const userMenu = [
  { title: 'My Projects', icon: folderIcon },
  { title: 'Sign Out', icon: outIcon },
  { title: 'Collaborate', icon: collaborateIcon },
];

const projectMenu = [
  { title: 'New a project...', icon: newProjectIcon },
  { title: 'Make a copy', icon: makeCopyIcon },
  { title: 'Rename project', icon: renameProjectIcon },
  { title: 'Finish project', icon: finishVideoIcon },
  { title: 'Move to trash', icon: trashIcon },
  { title: 'Close project', icon: closeProjectIcon },
];

const MenuAppBar = observer(() => {
  const anchorRef = React.useRef(null);
  let menu = [];

  const { save, modified } = useProjectStore();
  const { isSuperAdmin } = useUserStore();
  const { openModal } = useModalStore();

  const projectAdminMenu = [
    { title: 'Save as', icon: saveAsIcon, action: () => openModal(SAVE_PROJECT_MODAL) },
  ];

  const saveProject = React.useCallback(async () => {
    try {
      await save();
    } catch (e) {
      showError(e.message);
    }
  }, []);

  if (isSuperAdmin) {
    menu = [...projectMenu, ...projectAdminMenu];
  } else {
    menu = projectMenu;
  }

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
                  )
                }
                items={menu}
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
                  onClick={() => saveProject()}
                  disabled={!modified}
                />
                <button
                  className={`icon-button ${modified ? 'active-save' : ''}`}
                  onClick={() => saveProject()}
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
