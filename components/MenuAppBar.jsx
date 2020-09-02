import React, { useRef, useCallback } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import { AppBar, Toolbar } from '@material-ui/core';

import Menu from './common/Menu';
import UserBox from './common/user/UserBox';
import ExpandButton from './common/ExpandButton';
import { USER_MENU_ITEMS } from '../lib/constants/ui';

// import logoIcon from '../public/static/svgImages/header/logo.svg';
import redoIcon from '../public/static/svgImages/header/redo.svg';
import undoIcon from '../public/static/svgImages/header/undo.svg';
import saveIcon from '../public/static/svgImages/header/save.svg';

import useProjectStore from './hooks/useProjectStore';
import useCommonStore from './hooks/useCommonStore';

import useUIStore from './hooks/useUIStore';
import Sidebar from './Sidebar';

const MenuAppBar = observer(() => {
  const anchorRef = useRef(null);

  const {
    modified,
    undoRedoAction,
    canUndo,
    canRedo,
    checkAndSave,
  } = useProjectStore();
  const common = useCommonStore();
  const {
    showProducePanel,
    setInitialView,
    changeRadioButton,
    closeAllWindows,
  } = useUIStore();

  const saveProject = useCallback(async () => {
    checkAndSave({ changeRadioButton, showProducePanel, closeAllWindows, setInitialView });
  }, [setInitialView, showProducePanel]);

  return (
    <div className="container-header" ref={anchorRef}>
      <AppBar position="static" className="app-bar">
        <Toolbar className="container-menu">
          <Sidebar />
          {/* <div className="flex-vertical-center"> */}
          {/*  <SVGInline */}
          {/*    className="logo flex" */}
          {/*    classSuffix="" */}
          {/*    svg={logoIcon} */}
          {/*    cleanup={['title']} */}
          {/*  /> */}
          {/* </div> */}

          <div className="container-menu__actions">
            <div>
              <SVGInline
                className={classnames('icon icon-button', { active: canUndo })}
                classSuffix=""
                svg={undoIcon}
                cleanup={['title']}
                component="button"
                disabled={!canUndo}
                onClick={() => undoRedoAction(true)}
              />
              <button
                className={classnames('icon-button container-menu__button-text', { active: canUndo })}
                disabled={!canUndo}
                onClick={() => undoRedoAction(true)}
              >
                undo
              </button>
            </div>
            <div>
              <SVGInline
                className={classnames('icon icon-button', { active: canRedo })}
                classSuffix=""
                svg={redoIcon}
                cleanup={['title']}
                component="button"
                disabled={!canRedo}
                onClick={() => undoRedoAction(false)}
              />
              <button
                className={classnames('icon-button container-menu__button-text', { active: canRedo })}
                disabled={!canRedo}
                onClick={() => undoRedoAction(false)}
              >
                redo
              </button>
            </div>
            <div>
              <SVGInline
                className={`icon icon-button ${modified ? 'active-save' : ''}`}
                classSuffix=""
                svg={saveIcon}
                cleanup={['title']}
                component="button"
                onClick={saveProject}
                disabled={!modified}
              />
              <button
                className={`icon-button container-menu__button-text ${modified ? 'active-save' : ''}`}
                onClick={saveProject}
                disabled={!modified}
              >
                save
              </button>
            </div>
          </div>

          <ExpandButton />

          <Menu
            toggleElement={<UserBox />}
            items={USER_MENU_ITEMS(common)}
            className="user-menu flex-center"
            needEndIcon
          />
        </Toolbar>
      </AppBar>
    </div>
  );
});

export default MenuAppBar;
