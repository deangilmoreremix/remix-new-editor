import * as React from 'react';
import { observer } from 'mobx-react';
import Router from 'next/router';
import SVGInline from 'react-svg-inline';
import { Grid, AppBar, Toolbar } from '@material-ui/core';

// import Menu from './common/Menu';
import UserBox from './common/user/UserBox';
// import { SAVE_PROJECT_MODAL } from '../lib/constants/modals';
import { ROUTES } from '../lib/constants/routing';
import { PRODUCE_TABS } from '../lib/constants/ui';
// import { PRODUCE_TABS, USER_MENU_ITEMS, PROJECT_MENU_ITEMS } from '../lib/constants/ui';

import logoIcon from '../public/static/svgImages/header/logo.svg';
// import redoIcon from '../public/static/svgImages/header/redo.svg';
// import undoIcon from '../public/static/svgImages/header/undo.svg';
import saveIcon from '../public/static/svgImages/header/save.svg';
// import hamburgerIcon from '../public/static/svgImages/header/hamburger.svg';
// import saveAsIcon from '../public/static/svgImages/menu/save-as.svg';

import useProjectStore from './hooks/useProjectStore';
// import useUserStore from './hooks/useUserStore';
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
  } = useProjectStore();
  // const { openModal } = useModalStore();
  const { showProducePanel, setInitialView } = useUIStore();

  // const menu = React.useMemo(() => {
  //   const projectAdminMenu = [
  //     { title: 'Save as', icon: saveAsIcon, action: () => openModal(SAVE_PROJECT_MODAL) },
  //   ];
  //
  //   return [
  //     ...PROJECT_MENU_ITEMS,
  //     ...(isSuperAdmin ? projectAdminMenu : []),
  //   ];
  // }, [isSuperAdmin, openModal]);

  const saveProject = React.useCallback(async () => {
    try {
      const errors = validateBeforeSave(item);
      if (errors) {
        switch (true) {
          case errors.title: {
            return showProducePanel({ tab: PRODUCE_TABS.SETTINGS, focusTitle: true });
          }
          default: {
            return showError('The project is not valid.');
          }
        }
      } else {
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
          <Grid container>
            <Grid item xs={1} className="flex-vertical-center">
              {/* <Menu */}
              {/* toggleElement={ */}
              {/* ( */}
              {/* <SVGInline */}
              {/* className="icon icon-button" */}
              {/* classSuffix="" */}
              {/* svg={hamburgerIcon} */}
              {/* cleanup={['title']} */}
              {/* /> */}
              {/* ) */}
              {/* } */}
              {/* items={menu} */}
              {/* className="project-menu" */}
              {/* parent={anchorRef} */}
              {/* placement="bottom-start" */}
              {/* /> */}
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
                {/* <SVGInline */}
                {/* className="auto-margin icon icon-button" */}
                {/* classSuffix="" */}
                {/* svg={undoIcon} */}
                {/* cleanup={['title']} */}
                {/* component="button" */}
                {/* /> */}
                {/* <button className="icon-button">undo</button> */}
              </div>
              <div className="auto-margin">
                {/* <SVGInline */}
                {/* className="auto-margin icon icon-button" */}
                {/* classSuffix="" */}
                {/* svg={redoIcon} */}
                {/* cleanup={['title']} */}
                {/* component="button" */}
                {/* /> */}
                {/* <button className="icon-button">redo</button> */}
              </div>
              <div className="auto-margin">
                <SVGInline
                  className={`auto-margin icon icon-button ${modified ? 'active-save' : ''}`}
                  classSuffix=""
                  svg={saveIcon}
                  cleanup={['title']}
                  component="button"
                  onClick={saveProject}
                  disabled={!modified}
                />
                <button
                  className={`icon-button ${modified ? 'active-save' : ''}`}
                  onClick={saveProject}
                  disabled={!modified}
                >
                  save
                </button>
              </div>
            </Grid>
            <Grid item xs={6} />
            <Grid className="user-menu" item xs={2}>
              <UserBox />
              {/* <Menu */}
              {/* toggleElement={<UserBox />} */}
              {/* items={USER_MENU_ITEMS} */}
              {/* className="user-menu flex-center" */}
              {/* needEndIcon */}
              {/* /> */}
            </Grid>
          </Grid>
        </Toolbar>
      </AppBar>
    </div>
  );
});

export default MenuAppBar;
