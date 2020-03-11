import React, { useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import SwipeableDrawer from '@material-ui/core/SwipeableDrawer';
import Button from '@material-ui/core/Button';
import List from '@material-ui/core/List';
import Divider from '@material-ui/core/Divider';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';

import PropTypes from '../../../lib/PropTypes';

const useStyles = makeStyles({
  list: {
    width: 250,
  },
  fullList: {
    width: 'auto',
  },
});

function NavbarHamburger(props) {
  const { itemsTop, itemsBottom } = props;
  const classes = useStyles();
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
    <div
      className={classes.list}
      role="presentation"
      onClick={toggleDrawer(side, false)}
      onKeyDown={toggleDrawer(side, false)}
    >
      <List>
        {itemsTop.map((item) => (
          <ListItem button key={item.title}>
            <ListItemIcon>{item.iconName}</ListItemIcon>
            <ListItemText primary={item.title} />
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        {itemsBottom.map((item) => (
          <ListItem button key={item.title}>
            <ListItemIcon>{item.iconName}</ListItemIcon>
            <ListItemText primary={item.title} />
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <div>
      <Button onClick={toggleDrawer('left', true)}>&#5010;</Button>
      <SwipeableDrawer
        open={position.left}
        onClose={toggleDrawer('left', false)}
        onOpen={toggleDrawer('left', true)}
      >
        {sideList('left')}
      </SwipeableDrawer>
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
