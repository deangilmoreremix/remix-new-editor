import React, { useState } from 'react';
import SVGInline from 'react-svg-inline';
import classnames from 'classnames';
import { panelItems } from '../../../../lib/constants/imageEditor/editor-panel';
import PanelContext from './context';

import PanelContent from './PanelContent';

const Index = () => {
  const [activeButton, setActiveButton] = useState('TEMPLATES');
  const [searchValue, setSearchValue] = useState('');

  const onChangeSection = (item) => {
    setActiveButton(item);
    setSearchValue('');
  };

  const onSearch = (value) => {
    setSearchValue(value);
  };

  return (
    <PanelContext.Provider value={{ activeButton, onSearch, searchValue }}>
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
    </PanelContext.Provider>
  );
};

export default Index;
