import React from 'react';
import SVGInline from 'react-svg-inline';

import arrowIcon from '../../../public/static/images/arrow-red.svg';
import downloadIcon from '../../../public/static/images/download.svg';

import FormSelect from '../../form/FormSelect';

const selectItems = [
  { value: 'First item' },
  { value: 'Second item' },
];

const ThumbnailsHeader = () => {
  const onChange = (e) => {
    console.log(e);
  };

  return (
    <div className="thumbnails__header">
      <div className="thumbnails__close">
        <SVGInline
          className="thumbnails__close-btn"
          svg={arrowIcon}
          component="button"
        />
        <p className="thumbnails__close-text">return to SmartVideo editor</p>
      </div>

      <div className="thumbnails__header-pull">
        <button type="button" className="thumbnails__header-download">
          <SVGInline
            svg={downloadIcon}
          />
          <p>Download</p>
        </button>
        <div className="thumbnails__header-select">
          <FormSelect
            items={selectItems}
            minWidth="auto"
            onChange={onChange}
          />
          <SVGInline
            className="thumbnails__header-select-icon"
            svg={arrowIcon}
          />
        </div>
      </div>
    </div>
  );
};

export default ThumbnailsHeader;
