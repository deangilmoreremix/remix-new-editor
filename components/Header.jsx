import React, { useState } from 'react';

import MenuAppBar from './MenuAppBar';
import useProjectStore from './hooks/useProjectStore';

function Header() {
  const [anchorEl, setAnchorEl] = useState(null);
  const { save } = useProjectStore();
  const open = Boolean(anchorEl);

  const saveProject = async () => {
    await save();
  };

  const openMenu = event => {
    setAnchorEl(event.currentTarget);
  };

  const closeMenu = () => {
    setAnchorEl(null);
  };

  return (
    <header className="menu-app-bar">
      <MenuAppBar
        open={open}
        openMenu={openMenu}
        closeMenu={closeMenu}
        anchorEl={anchorEl}
        onSave={saveProject}
      />
    </header>
  );
}

export default Header;
