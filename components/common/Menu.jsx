import * as React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import { Popper, Button, Grow, ClickAwayListener, Paper } from '@material-ui/core';

import togglerIcon from '../../public/static/svgImages/common/toggler.svg';
import arrowIcon from '../../public/static/images/arrow-red.svg';

import PropTypes from '../../lib/PropTypes';

const Menu = observer((
  {
    toggleElement,
    items, className,
    needEndIcon,
    parent,
    placement,
    useButton,
    onClick,
  }) => {
  const anchorRef = React.useRef(null);
  const [open, setOpen] = React.useState(false);

  const handleAction = (action) => {
    setOpen(false);
    if (action && typeof action === 'function') {
      action();
    }

    if (onClick && action) {
      onClick(action);
    }
  };

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
              onClick={() => { setOpen(!open); }}
            >
              {toggleElement}
              <SVGInline
                className="menu-arrow"
                svg={arrowIcon}
                cleanup={['arrow']}
              />
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
                    <button
                      key={`menu-${item.title}`}
                      onClick={onClick
                        ? (() => handleAction(item.title)) : (() => handleAction(item.action))}
                      className="menu__item"
                    >
                      {item.icon ? (
                        <SVGInline
                          className="menu__item-icon"
                          classSuffix=""
                          svg={item.icon}
                          cleanup={['title']}
                        />
                      ) : null}
                      {item.title}
                    </button>
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
