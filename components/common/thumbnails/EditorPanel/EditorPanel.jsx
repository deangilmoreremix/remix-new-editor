import React, { useState } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';

import { panelItems } from '../../../../lib/constants/imageEditor/editor-panel';
import PanelContext from './PanelContext';

import PanelContent from './PanelContent';

const EditorPanel = () => {
  const [activeButton, setActiveButton] = useState(Object.keys(panelItems)[0]);
  const [query, setQuery] = useState('');

  const onChangeSection = (item) => {
    setActiveButton(item);
    setQuery('');
  };

  const onSearch = () => {
    console.log(query);
  };

  return (
    <PanelContext.Provider value={{ activeButton, setQuery, query, onSearch }}>
      <div className="editor-sidebar">
        <div className="editor-panel">
          {
            Object.keys(panelItems).map(item => (
              <button
                type="button"
                key={panelItems[item].name}
                className={classnames('editor-panel__item', { 'editor-panel__item-active': activeButton === item })}
                onClick={() => onChangeSection(item)}
              >
                <SVGInline
                  className="editor-panel__icon"
                  svg={panelItems[item].icon}
                />
                <span className="editor-panel__name">{panelItems[item].name}</span>
              </button>
            ))
          }
        </div>
        <PanelContent activeItem={activeButton} />
      </div>
    </PanelContext.Provider>
  );
};

export default EditorPanel;
