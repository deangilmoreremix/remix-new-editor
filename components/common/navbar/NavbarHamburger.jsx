import React, { useState } from 'react';
import SVGInline from 'react-svg-inline';

import { makeStyles } from '@material-ui/core/styles';
import { ListItemText, ListItemIcon, Divider, ListItem, Button, Drawer, List } from '@material-ui/core';

import hamburgerIcon from '../../../public/static/svgImages/header/hamburger.svg';

import PropTypes from '../../../lib/PropTypes';

const useStyles = makeStyles((theme) => ({
  list: {
    width: 250,
  },
  fullList: {
    width: 'auto',
  },
}));

function NavbarHamburger(props) {
  const { itemsTop, itemsBottom, classes } = props;
  // const classes = useStyles();
  const [position, setPosition] = useState({
    left: false,
  });

  const toggleDrawer = (side, open) => event => {
    if (event && event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setPosition({ ...position, [side]: open });
  };

  const sideList = side => (
      <List>
        {itemsTop.map((item) => (
          <ListItem button key={item.title}>
            <ListItemIcon>{item.iconName}</ListItemIcon>
            <ListItemText primary={item.title} />
          </ListItem>
        ))}
      </List>
  );

  return (
    <div>
      <SVGInline
        className="icon icon-button"
        classSuffix=""
        svg={hamburgerIcon}
        cleanup={['title']}
        component="button"
        onClick={toggleDrawer('left', true)}
      />
      <Drawer
        open={position.left}
        onClose={toggleDrawer('left', false)}
        onOpen={toggleDrawer('left', true)}
        className={classes.drawer}
      >
        {sideList('left')}
      </Drawer>
    </div>
  );
}

NavbarHamburger.propTypes = {
  itemsTop: PropTypes.arrayOf(PropTypes.shape({
    title: PropTypes.string,
    iconName: PropTypes.string,
  })),
  itemsBottom: PropTypes.arrayOf(PropTypes.shape({
    title: PropTypes.string,
    iconName: PropTypes.string,
  })),
};

NavbarHamburger.defaultProps = {
  itemsTop: [],
  itemsBottom: [],
};

export default NavbarHamburger;
