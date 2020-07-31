import * as React from 'react';
import { observer } from 'mobx-react';
import Router from 'next/router';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';
import { AppBar, Toolbar } from '@material-ui/core';

import { radioButton } from '../lib/constants/windowsLogics';

import Menu from './common/Menu';
import UserBox from './common/user/UserBox';
import ExpandButton from './common/ExpandButton';
// import { SAVE_PROJECT_MODAL } from '../lib/constants/modals';
import { ROUTES } from '../lib/constants/routing';
import { PRODUCE_TABS, USER_MENU_ITEMS } from '../lib/constants/ui';

// import logoIcon from '../public/static/svgImages/header/logo.svg';
import redoIcon from '../public/static/svgImages/header/redo.svg';
import undoIcon from '../public/static/svgImages/header/undo.svg';
import saveIcon from '../public/static/svgImages/header/save.svg';
// import hamburgerIcon from '../public/static/svgImages/header/hamburger.svg';
// import saveAsIcon from '../public/static/svgImages/menu/save-as.svg';

import useProjectStore from './hooks/useProjectStore';
import useCommonStore from './hooks/useCommonStore';
// import useModalStore from './hooks/useModalStore';

import { showError } from '../lib/services/alertService';
import useUIStore from './hooks/useUIStore';
import { validateBeforeSave } from '../lib/utils/project';


const MenuAppBar = observer(() => {
  const anchorRef = React.useRef(null);

  const {
    save,
    modified,
    item,
    undoRedoAction,
    canUndo,
    canRedo,
  } = useProjectStore();
  // const { openModal } = useModalStore();
  const common = useCommonStore();
  const { showProducePanel, setInitialView, changeRadioButton, closeAllWindows } = useUIStore();

  // const menu = React.useMemo(() => {
  // const projectAdminMenu = [
  //   { title: 'Save as', icon: saveAsIcon, action: () => openModal(SAVE_PROJECT_MODAL) },
  // ];

  // return [
  //   ...PROJECT_MENU_ITEMS,
  // ...(isSuperAdmin ? projectAdminMenu : []),
  // ];
  // }, [openModal]);

  const saveProject = React.useCallback(async () => {
    try {
      const errors = validateBeforeSave(item);
      if (errors) {
        switch (true) {
          case errors.title: {
            changeRadioButton(radioButton.BOTTOM);
            return showProducePanel({ tab: PRODUCE_TABS.SETTINGS });
          }
          default: {
            return showError('The project is not valid.');
          }
        }
      } else {
        closeAllWindows();
        const project = await save();
        if (project && project._id) {
          Router.push(
            {
              pathname: ROUTES.edit,
              query: {
                project: project._id,
              },
            },
            undefined,
            {
              shallow: true,
            },
          );
          setInitialView();
        }
      }
    } catch (e) {
      showError(e.message);
    }
  }, [item, save, setInitialView, showProducePanel]);

  return (
    <div className="container-header" ref={anchorRef}>
      <AppBar position="static" className="app-bar">
        <Toolbar className="container-menu">
          {/* <Grid item xs={1} className="flex-vertical-center"> */}
          {/*   <Menu */}
          {/*   toggleElement={ */}
          {/*   ( */}
          {/*   <SVGInline */}
          {/*   className="icon icon-button" */}
          {/*   classSuffix="" */}
          {/*   svg={hamburgerIcon} */}
          {/*   cleanup={['title']} */}
          {/*   /> */}
          {/*   ) */}
          {/*   } */}
          {/*   items={menu} */}
          {/*   className="project-menu" */}
          {/*   parent={anchorRef} */}
          {/*   placement="bottom-start" */}
          {/*   /> */}
          {/* </Grid> */}
          {/* <Grid item xs={2} className="flex-vertical-center"> */}
          {/*   <SVGInline */}
          {/*   className="logo flex" */}
          {/*   classSuffix="" */}
          {/*   svg={logoIcon} */}
          {/*   cleanup={['title']} */}
          {/*   /> */}
          {/* </Grid> */}

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
