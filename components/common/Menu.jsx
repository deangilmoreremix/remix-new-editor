import * as React from 'react';
import { observer } from 'mobx-react';
import SVGInline from 'react-svg-inline';
import { Popper, Button, Grow, MenuItem, MenuList, ClickAwayListener, Paper } from '@material-ui/core';

import { useEffect } from 'react';
import togglerIcon from '../../public/static/svgImages/common/toggler.svg';

import PropTypes from '../../lib/PropTypes';

const Menu = observer(({ toggleElement, items, className, needEndIcon, parent, placement }) => {
  const [open, setOpen] = React.useState(false);
  const [extraProps, setExtraProps] = React.useState({});
  const anchorRef = React.useRef(null);
  return (
    <div className={className || ''}>
      <Button
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
        {toggleElement()}
      </Button>
      <Popper open={open} role={undefined} transition disablePortal className="popover" placement={placement || 'bottom'} anchorEl={parent ? parent.current : anchorRef.current}>
        {({ TransitionProps, placement: currentPlacement }) => (
          <Grow
            {...TransitionProps}
            style={{ transformOrigin: currentPlacement === 'bottom' ? 'center top' : 'center bottom' }}
          >
            <Paper>
              <ClickAwayListener onClickAway={() => { setOpen(false); }}>
                <MenuList id="menu-list-grow" onKeyDown={() => { setOpen(false); }}>
                  {items.map((item) => (
                    <MenuItem key={`menu-${item.name}`} onClick={() => { item.onClick(); setOpen(false); }}>
                      {item.icon ? (
                        <SVGInline
                          className="icon"
                          classSuffix=""
                          svg={item.icon}
                          cleanup={['title']}
                        />
                      ) : null}
                      <span className={item.icon ? 'margin-left-5' : ''}>{item.title}</span>
                    </MenuItem>
                  ))}
                </MenuList>
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
  needEndIcon: PropTypes.bool,
  items: PropTypes.arrayOrObservableArrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    icon: PropTypes.string,
    onClick: PropTypes.func.isRequired,
  })),
};

export default Menu;
