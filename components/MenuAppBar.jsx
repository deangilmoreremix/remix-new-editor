import React, { useRef, useCallback, useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import { AppBar, Toolbar } from '@material-ui/core';

import Menu from './common/Menu';
import UserBox from './common/user/UserBox';
import ExpandButton from './common/ExpandButton';
import HelpIconComponent from './common/HelpIcon';

import { HEADER_ACTIONS, USER_MENU_ITEMS } from '../lib/constants/ui';
import { headerTooltips } from '../lib/constants/tooltips';
import { DOMAIN_VIDEOREMIX } from '../lib/constants/project';
import { ENTER_KEY } from '../lib/constants/keyCodes';

import logoIcon from '../public/static/svgImages/header/logo.svg';
import redoIcon from '../public/static/svgImages/header/redo.svg';
import undoIcon from '../public/static/svgImages/header/undo.svg';
import saveIcon from '../public/static/svgImages/header/save.svg';
import editIcon from '../public/static/svgImages/header/edit-project.svg';

import useProjectStore from './hooks/useProjectStore';
import useCommonStore from './hooks/useCommonStore';
import useUserStore from './hooks/useUserStore';
import useUIStore from './hooks/useUIStore';

import Sidebar from './Sidebar';

import PropTypes from '../lib/PropTypes';

const {
  REDO,
  UNDO,
  SAVE,
} = HEADER_ACTIONS;

const MenuAppBar = observer(({ whiteLabelManager }) => {
  const anchorRef = useRef(null);

  const [isProjectTitle, setProjectTitle] = useState(false);
  const [userItems, setUserItems] = useState([]);

  const {
    modified,
    undoRedoAction,
    canUndo,
    canRedo,
    checkAndSave,
    item,
    updateItem,
  } = useProjectStore();

  const common = useCommonStore();
  const { oneOfFeatureEnabled } = useUserStore();
  const {
    showProducePanel,
    setInitialView,
    changeRadioButton,
    closeAllWindows,
  } = useUIStore();

  useEffect(() => {
    if (USER_MENU_ITEMS(common)) {
      const items = USER_MENU_ITEMS(common);
      setUserItems(oneOfFeatureEnabled ? items : items.filter((i) => !i.isFeatureDependence));
    }
  }, []);

  const saveProject = useCallback(async () => {
    checkAndSave({ changeRadioButton, showProducePanel, closeAllWindows, setInitialView });
  }, [setInitialView, showProducePanel]);

  const updateTitle = useCallback((event) => {
    updateItem({ title: event.target.value });
  }, []);

  const onEnterKeyPress = (event) => {
    if (event.keyCode === ENTER_KEY) {
      setProjectTitle(false);
    }
  };

  return (
    <div className="container-header" ref={anchorRef}>
      <AppBar position="static" className="app-bar">
        <Toolbar className="container-menu">
          <div className="container-logo-humburger">
            <Sidebar />
            <div className="flex-vertical-center">
              {whiteLabelManager && whiteLabelManager.domain !== DOMAIN_VIDEOREMIX
                ? (<a className="navbar-logo-wl" href="/" />)
                : (
                  <SVGInline
                    className="logo flex"
                    classSuffix=""
                    svg={logoIcon}
                    cleanup={['title']}
                  />
                )}
            </div>
          </div>


          <div className="container-menu__actions">
            <div className="container-menu__actions__item">
              <HelpIconComponent noDelay noIcon message={headerTooltips.undo}>
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
                    {UNDO}
                  </button>
                </div>
              </HelpIconComponent>
            </div>
            <div className="container-menu__actions__item">
              <HelpIconComponent noDelay noIcon message={headerTooltips.redo}>
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
                    {REDO}
                  </button>
                </div>
              </HelpIconComponent>
            </div>
            <div className="container-menu__actions__item">
              <HelpIconComponent noDelay noIcon message={headerTooltips.save}>
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
                    {SAVE}
                  </button>
                </div>
              </HelpIconComponent>
            </div>
          </div>
          <div className="container-menu__project-name">
            {isProjectTitle ? (
              <input
                /* eslint-disable-next-line jsx-a11y/no-autofocus */
                autoFocus
                type="text"
                value={item.title}
                onChange={updateTitle}
                onKeyDown={onEnterKeyPress}
                onBlur={() => setProjectTitle(false)}
              />
            ) : (
              <span onDoubleClick={() => setProjectTitle(true)}>
                {item.title || 'Untitled project'}
              </span>
            )}
            <SVGInline
              className="icon icon-button"
              classSuffix=""
              svg={editIcon}
              cleanup={['title']}
              component="button"
              onClick={() => setProjectTitle(!isProjectTitle)}
            />
          </div>
          <ExpandButton />
          <Menu
            toggleElement={<UserBox />}
            items={userItems}
            className="user-menu flex-center"
            needEndIcon
          />
        </Toolbar>
      </AppBar>
    </div>
  );
});

MenuAppBar.propTypes = {
  whiteLabelManager: PropTypes.shape({}),
};

export default MenuAppBar;
