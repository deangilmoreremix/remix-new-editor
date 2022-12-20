import { useRouter } from 'next/router';
import * as React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import Link from 'next/link';

import { Popper, Button, Grow, ClickAwayListener, Paper } from '@material-ui/core';
import Shortcuts from './Shortcuts';

import togglerIcon from '../../public/static/svgImages/common/toggler.svg';
import lineTogglerIcon from '../../public/static/svgImages/common/toggler-2.svg';

import PropTypes from '../../lib/PropTypes';
import { ACTION_LOGOUT ,SHORTCUT_ACTIONS} from '../../lib/constants/ui';

import HelpIconComponent from './HelpIcon';

const Menu = observer((
  {
    toggleElement,
    items,
    className,
    needEndIcon,
    parent,
    placement,
    useButton,
    onClick,
    lineDropIcon,
  }) => {
  const anchorRef = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const [showShortcut ,setShowShortcut] = React.useState(false);

  const { push } = useRouter();

  const handleAction = (arg) => {
    if(arg == SHORTCUT_ACTIONS) {
      setShowShortcut(true);
    }
    if (arg === ACTION_LOGOUT) {
      if (window.HelpCrunch) {
        window.HelpCrunch(arg);
      }
      push('/logout');
    }
  };

  const listItemClick = buttonItem => {
    if (onClick) {
      onClick(buttonItem.value);
    } else {
      handleAction(buttonItem.action);
    }
    setOpen(!open);
  };

  const menuButton = buttonItem => (
    <button
      key={`menu-${buttonItem.title}`}
      onClick={() => listItemClick(buttonItem)}
      className="menu__item"
    >
      {buttonItem.icon ? (
        <SVGInline
          className="menu__item-icon"
          classSuffix=""
          svg={buttonItem.icon}
          cleanup={['title']}
        />
      ) : null}
      {buttonItem.title}
      {buttonItem.isTooltip && (
        <HelpIconComponent
          whiteIcon
          projectCourses={buttonItem.tooltip.includes('Strategy')}
          placement="left-end"
          height={25}
          message={buttonItem.tooltip}
        />
      )}
    </button>
  );

  return (
    <div className={className || ''}>
      {
        useButton
          ? (
            <button
              className="menu__open"
              ref={anchorRef}
              aria-controls={open ? 'menu-list-grow' : undefined}
              aria-haspopup="true"
              onClick={() => setOpen(!open)}
            >
              {toggleElement}
              {needEndIcon && (
                <SVGInline
                  className="toggler-icon"
                  classSuffix=""
                  svg={togglerIcon}
                  cleanup={['title']}
                />
              )}
            </button>
          )
          : (

            <Button
              className="menu__open"
              ref={anchorRef}
              aria-controls={open ? 'menu-list-grow' : undefined}
              aria-haspopup="true"
              onClick={() => { setOpen(!open); }}
              endIcon={needEndIcon ? (
                <SVGInline
                  className="toggler-icon"
                  classSuffix=""
                  svg={lineDropIcon ? lineTogglerIcon : togglerIcon}
                  cleanup={['title']}
                />
              ) : null}
            >
              {toggleElement}
            </Button>
          )
      }
      {showShortcut && <Shortcuts showShortcut={showShortcut}
        setShowShortcut={setShowShortcut}
      />}
      <Popper
        open={open}
        role={undefined}
        transition
        disablePortal
        className="popover"
        placement={placement || 'bottom'}
        anchorEl={parent ? parent.current : anchorRef.current}
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
                  {items.map((item) => (
                    // eslint-disable-next-line no-nested-ternary
                    item.url ? (
                      item.isLink ? (
                        <div>
                          <Link href={item.url}>
                            {menuButton(item)}
                          </Link>
                        </div>
                      ) : (
                        // eslint-disable-next-line react/jsx-no-target-blank
                        <a key={item.url} href={`//${item.url}`} target="_blank">
                          {menuButton(item)}
                        </a>
                      )
                    ) : (menuButton(item))
                  ))}
                </div>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </div>
  );
});

Menu.propTypes = {
  className: PropTypes.string,
  toggleElement: PropTypes.node.isRequired,
  parent: PropTypes.shape({ current: PropTypes.any }),
  placement: PropTypes.string,
  needEndIcon: PropTypes.bool,
  items: PropTypes.arrayOrObservableArrayOf(PropTypes.shape({
    title: PropTypes.string.isRequired,
    icon: PropTypes.string,
  })),
  useButton: PropTypes.bool,
  onClick: PropTypes.func,
  lineDropIcon: PropTypes.bool,
};

Menu.defaultProps = {
  useButton: false,
  lineDropIcon: false,
};

export default Menu;
