import React from 'react';
import SVGInline from 'react-svg-inline';
import search from '../../../public/static/images/search.svg';
import PropTypes from '../../../lib/PropTypes';
import { panelItems } from '../../../lib/constants/imageEditor/editor-panel';

import FormTextField from '../../form/FormTextField';

const Header = ({placeholder}) => {
  const placeholderText = placeholder ? panelItems[placeholder].name : "";

  return (
    <div className="editor-sidebar-header">
      <div className='editor-sidebar-search'>
        <SVGInline
          className="editor-icon-search"
          svg={search}
          alt=""
        />
        <FormTextField placeholder={`Search ${placeholderText}`} />
      </div>
    </div>
  );
};

Header.propTypes = {
  placeholder: PropTypes.string.isRequired,
};

export default Header;