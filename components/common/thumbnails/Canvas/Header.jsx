import React from 'react';
import SVGInline from 'react-svg-inline';

import arrowBackIcon from '../../../../public/static/images/arrow-back.svg';
import pageIcon from '../../../../public/static/images/page.svg';
import copyIcon from '../../../../public/static/images/copy.svg';
import addIcon from '../../../../public/static/images/add.svg';

const Header = () => (
  <div className="thumbnails-header">
    <SVGInline
      className="thumbnails-header__back"
      svg={arrowBackIcon}
      component="button"
    />
    <div className="thumbnails-header__block">
      <SVGInline
        svg={pageIcon}
        component="button"
      />
      <SVGInline
        svg={copyIcon}
        component="button"
      />
      <SVGInline
        svg={addIcon}
        component="button"
      />
    </div>
  </div>
);

export default Header;
