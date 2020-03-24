import React, { useContext } from 'react';
import SVGInline from 'react-svg-inline';
import search from '../../../public/static/images/search.svg';
import { panelItems } from '../../../lib/constants/imageEditor/editor-panel';
import PanelContext from './context';

import FormTextField from '../../form/FormTextField';

const Header = () => {
  const { activeButton, onSearch, searchValue } = useContext(PanelContext);
  const placeholderText = activeButton ? panelItems[activeButton].name : '';

  return (
    <div className="editor-sidebar-header">
      <div className="editor-sidebar-search">
        <SVGInline
          className="editor-icon-search"
          svg={search}
          alt=""
        />
        <FormTextField
          placeholder={`Search ${placeholderText}`}
          onChange={onSearch}
          value={searchValue}
        />
      </div>
    </div>
  );
};

export default Header;
