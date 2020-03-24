import React, { useState } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';
import { panelItems } from '../../../lib/constants/imageEditor/editor-panel';

import PanelContent from './PanelContent';

const EditorPanel = () => {
  const [activeButton, setActiveButton] = useState('TEMPLATES');

  return (
    <div className="editor-sidebar">
      <div className="editor-panel">
        {
          Object.keys(panelItems).map(item => (
            <button
              type="button"
              key={panelItems[item].name}
              className={classnames('editor-panel__item', { 'editor-panel__item-active': activeButton === item })}
              onClick={() => setActiveButton(item)}
            >
              <span className="editor-panel__icon">
                <SVGInline
                  svg={panelItems[item].icon}
                  alt=""
                />
              </span>
              <span className="editor-panel__name">{panelItems[item].name}</span>
            </button>
          ))
        }
      </div>
      <PanelContent activeItem={activeButton} />
    </div>
  );
};

export default EditorPanel;
