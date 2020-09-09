import { useRouter } from 'next/router';
import * as React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import { Popper, Button, Grow, ClickAwayListener, Paper } from '@material-ui/core';

import togglerIcon from '../../public/static/svgImages/common/toggler.svg';

import PropTypes from '../../lib/PropTypes';
import { ACTION_LOGOUT } from '../../lib/constants/ui';

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
  }) => {
  const anchorRef = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const { push } = useRouter();

  const handleAction = (arg) => {
    if (arg === ACTION_LOGOUT) {
      if (window.HelpCrunch) {
        window.HelpCrunch(arg, () => {
          push('/logout');
        });
      } else {
        push('/logout');
      }
    }
  };

  const menuButton = buttonItem => (
    <button
      key={`menu-${buttonItem.title}`}
      onClick={onClick
        ? (() => onClick(buttonItem.value)) : (() => handleAction(buttonItem.action))}
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
      <span className="menu__item-title">{buttonItem.title}</span>
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
                  svg={togglerIcon}
                  cleanup={['title']}
                />
              ) : null}
            >
              {toggleElement}
            </Button>
          )
      }
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
                    item.url
                      ? (
                        // eslint-disable-next-line react/jsx-no-target-blank
                        <a key={item.url} href={`//${item.url}`} target="_blank">
                          {menuButton(item)}
                        </a>
                      )
                      : (menuButton(item))
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
};

Menu.defaultProps = {
  useButton: false,
};

export default Menu;
