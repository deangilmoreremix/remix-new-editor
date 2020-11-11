import React from 'react';

import MenuAppBar from './MenuAppBar';

import PropTypes from '../lib/PropTypes';

function Header({ whiteLabelManager }) {
  return (
    <header className="menu-app-bar">
      <MenuAppBar whiteLabelManager={whiteLabelManager} />
    </header>
  );
}

Header.propTypes = {
  whiteLabelManager: PropTypes.shape({}),
};

export default Header;
