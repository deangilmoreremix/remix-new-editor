import React, { useContext } from 'react';
import SVGInline from 'react-svg-inline';

import searchIcon from '../../../../public/static/images/search.svg';

import { panelItems } from '../../../../lib/constants/imageEditor/editor-panel';
import PanelContext from './PanelContext';

import FormTextField from '../../../form/FormTextField';

const Header = () => {
  const { activeButton, setQuery, query, onSearch } = useContext(PanelContext);
  const placeholderText = `Search ${activeButton ? panelItems[activeButton].name : ''}`;

  return (
    <div className="editor-sidebar-header">
      <div className="editor-sidebar-search">
        <SVGInline
          className="editor-icon-search"
          svg={searchIcon}
          alt=""
          onClick={onSearch}
        />
        <FormTextField
          placeholder={placeholderText}
          onChange={value => setQuery(value)}
          onEnter={onSearch}
          value={query}
        />
      </div>
    </div>
  );
};

export default Header;
