import React from 'react';
import SVGInline from 'react-svg-inline';

import arrowBack from '../../../../public/static/images/arrow-back.svg';
import page from '../../../../public/static/images/page.svg';
import copy from '../../../../public/static/images/copy.svg';
import add from '../../../../public/static/images/add.svg';

const CanvasHeader = () => (
  <div className="thumbnails-header">
    <button type="button" className="thumbnails-header__back">
      <SVGInline
        svg={arrowBack}
        alt=""
      />
    </button>
    <div className="thumbnails-header__block">
      <button type="button">
        <SVGInline
          svg={page}
          alt=""
        />
      </button>
      <button type="button">
        <SVGInline
          svg={copy}
          alt=""
        />
      </button>
      <button type="button">
        <SVGInline
          svg={add}
          alt=""
        />
      </button>
    </div>
  </div>
);

export default CanvasHeader;
