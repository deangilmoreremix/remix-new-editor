import React, { useMemo } from 'react';
import { observer } from 'mobx-react';
import { useWindowSize } from '@react-hook/window-size';

import useTimelineStore from '../../hooks/useTimelineStore';
import { contextButtons } from '../../../lib/constants/timelineContextMenu';

const buttonStyles = {
  height: 33,
};

const menuWidth = 200;

const ContextMenu = observer(() => {
  const {
    copiedItems,
    setCopiedItems,
    pasteElement,
    contextMenu,
    setContextMenu,
  } = useTimelineStore();

  const [windowWidth] = useWindowSize();

  const menuStyles = useMemo(() => {
    const menuHeight = buttonStyles.height * contextMenu.buttons.length;
    let menuLeft = contextMenu.posX;
    if (windowWidth < contextMenu.posX + menuWidth) {
      menuLeft -= menuWidth;
    }

    return {
      width: menuWidth,
      left: menuLeft,
      top: contextMenu.posY - menuHeight,
      height: menuHeight,
    };
  }, [contextMenu, windowWidth]);

  const copy = () => {
    setCopiedItems();
    setContextMenu({ isOpen: false });
  };

  return (
    <div className="context-menu" style={menuStyles}>
      {contextMenu?.isClickOnRow && copiedItems?.length ? (
        <button onClick={pasteElement} className="context-menu__button" style={buttonStyles}>{contextButtons.PASTE}</button>
      ) : (
        <button onClick={copy} className="context-menu__button" style={buttonStyles}>{contextButtons.COPY}</button>
      )}
    </div>
  );
});

export default ContextMenu;
