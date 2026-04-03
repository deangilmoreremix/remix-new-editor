import React, { useCallback, useMemo } from 'react';
import { observer } from 'mobx-react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import { Button, ClickAwayListener, Grow, Paper, Popper } from '@material-ui/core';
import { radioButton } from '../lib/constants/windowsLogics';

import {
  ACTION_MAKE_COPY,
  ACTION_NEW_PROJECT,
  ACTION_RENAME_PROJECT,
  ACTION_SAVE_PROJECT,
  ACTION_ARCHIVE,
  ACTION_WATCH_VIDEO,
  PRODUCE_TABS,
  SIDEBAR_MENU_ITEMS,
} from '../lib/constants/ui';
import { SAVE_PROJECT_MODAL, PAGE_SHOT_MODAL, ENHANCED_RECORDER_MODAL } from '../lib/constants/modals';

import hamburgerIcon from '../public/static/svgImages/header/hamburger.svg';

import useProjectStore from './hooks/useProjectStore';
import useCommonStore from './hooks/useCommonStore';
import useModalStore from './hooks/useModalStore';
import useUIStore from './hooks/useUIStore';
import useUserStore from './hooks/useUserStore';

import { showInfo } from '../lib/services/alertService';
import { headerTooltips } from '../lib/constants/tooltips';
import HelpIconComponent from './common/HelpIcon';

const Sidebar = observer(() => {
  const anchorRef = React.useRef(null);
  const [open, setOpen] = React.useState(false);

  const {
    modified,
    checkAndSave,
  } = useProjectStore();
  const { openModal } = useModalStore();
  const common = useCommonStore();
  const {
    showProducePanel,
    setInitialView,
    changeRadioButton,
    closeAllWindows,
  } = useUIStore();
  const { isSuperAdmin } = useUserStore();
  const elements = useMemo(() => [
    ...SIDEBAR_MENU_ITEMS(modified, common, isSuperAdmin),
  ], [modified]);

  const openUrl = useCallback((url) => { window.open(url); }, []);

  const saveProject = useCallback(async (actionType) => {
    checkAndSave({
      changeRadioButton,
      showProducePanel,
      closeAllWindows,
      setInitialView,
      actionType,
      afterSave: openUrl,
    });
  }, [setInitialView, showProducePanel]);

  const openSettingsMenu = useCallback(() => {
    closeAllWindows();
    changeRadioButton(radioButton.BOTTOM);
    showProducePanel({ tab: PRODUCE_TABS.SETTINGS });
  }, [showProducePanel]);

  const handleAction = (arg, options) => {
    setOpen(false);
    switch (arg) {
      case SAVE_PROJECT_MODAL:
      case PAGE_SHOT_MODAL:
      case ENHANCED_RECORDER_MODAL:
        openModal(arg);
        break;
      case ACTION_SAVE_PROJECT:
        saveProject();
        break;
      case ACTION_RENAME_PROJECT:
        openSettingsMenu();
        break;
      case ACTION_NEW_PROJECT:
        window.open('/edit');
        break;
      case ACTION_MAKE_COPY:
      case ACTION_WATCH_VIDEO:
        saveProject(arg);
        break;
      case ACTION_ARCHIVE:
        if (options.disabled) {
          showInfo('Project not saved');
        }
        break;
      default:
        if (typeof arg === 'function') {
          arg();
        }
        break;
    }
  };

  const menuButton = buttonItem => (
    buttonItem.display !== false
    && (
    <button
      key={`menu-${buttonItem.title}`}
      onClick={() => handleAction(buttonItem.action, buttonItem)}
      className={classnames('menu__item', { inactive: buttonItem.disabled })}
    >
      {buttonItem.icon ? (
        <SVGInline
          className="menu__item-icon"
          classSuffix=""
          svg={buttonItem.icon}
          cleanup={['title']}
          disabled={buttonItem.disabled}
        />
      ) : null}
      {buttonItem.title}
    </button>
    )
  );

  return (
    <div className="flex-vertical-center">
      <div className="project-menu">
        <Button
          className="menu__open"
          ref={anchorRef}
          aria-controls={open ? 'menu-list-grow' : undefined}
          aria-haspopup="true"
          onClick={() => { setOpen(!open); }}
        >
          <HelpIconComponent noIcon message={headerTooltips.menu}>
            <div>
              <SVGInline
                className="icon icon-button"
                classSuffix=""
                svg={hamburgerIcon}
                cleanup={['title']}
              />
            </div>
          </HelpIconComponent>
        </Button>
        <Popper
          open={open}
          role={undefined}
          transition
          disablePortal
          className="popover"
          placement="bottom-start"
          anchorEl={anchorRef.current}
        >
          {({ TransitionProps, placement: currentPlacement }) => (
            <Grow
              {...TransitionProps}
              style={{ transformOrigin: currentPlacement === 'bottom' ? 'center top' : 'center bottom' }}
            >
              <Paper>
                <ClickAwayListener onClickAway={() => { setOpen(false); }}>
                  <div
                    className="menu__list"
                    id="menu-list-grow"
                  >
                    {elements.map(element => (
                      element.url
                        ? (
                          // eslint-disable-next-line react/jsx-no-target-blank
                          <a key={element.url} href={!element.disabled ? `//${element.url}` : null} target="_blank">
                            {menuButton(element)}
                          </a>
                        )
                        : (menuButton(element))
                    ))}
                  </div>
                </ClickAwayListener>
              </Paper>
            </Grow>
          )}
        </Popper>
      </div>

    </div>
  );
});

export default Sidebar;
