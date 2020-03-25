import React from 'react';
import SVGInline from 'react-svg-inline';

import arrowBackIcon from '../../../../public/static/images/arrow-back.svg';
import pageIcon from '../../../../public/static/images/page.svg';
import copyIcon from '../../../../public/static/images/copy.svg';
import addIcon from '../../../../public/static/images/add.svg';

const CanvasHeader = () => (
  <div className="thumbnails-header">
    <button type="button" className="thumbnails-header__back">
      <SVGInline
        svg={arrowBackIcon}
      />
    </button>
    <div className="thumbnails-header__block">
      <button type="button">
        <SVGInline
          svg={pageIcon}
        />
      </button>
      <button type="button">
        <SVGInline
          svg={copyIcon}
        />
      </button>
      <button type="button">
        <SVGInline
          svg={addIcon}
        />
      </button>
    </div>
  </div>
);

export default CanvasHeader;
