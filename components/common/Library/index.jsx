import React, { useCallback, useState } from 'react';

import Buttons from './Buttons';
import Images from './Images';
import PropTypes from '../../../lib/PropTypes';
import { librarybtns } from '../../../lib/constants/library';


const Library = ({ images, btns, addImages, title }) => {
  const [viewPlaceholder, setViewPlaceholder] = useState(true);
  const [search, setSearch] = useState('');
  const [activeBtn, setActiveBtn] = useState(null);

  // === actions ===
  const handChange = e => setSearch(e.target.value);

  const handleFocus = useCallback(() => {
    setViewPlaceholder(false);
  }, []);

  const handleBlur = useCallback(() => {
    if (!search) { setViewPlaceholder(true); }
  }, [search]);

  const handleSearch = (e) => {
    if (e.keyCode === 13 && search) {
      console.log(search);
    }
  };
  // === actions ===

  return (
    <div className="library-layout">
      <h2 className="library-layout__title">{title}</h2>

      <div className="library-layout__row library-layout__row-first">
        <div>
          <button
            type="button"
            className="library-layout__add"
            onClick={addImages}
          >
            Add Images
          </button>
        </div>
        <div className="library-layout__block-search">
          <input
            className="library-layout__search"
            id="library-layout__search"
            type="text"
            value={search}
            onChange={handChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleSearch}
          />
          {viewPlaceholder && (
          <label htmlFor="library-layout__search">
            Try searching for keywords,like
            <span> business, sports, meeting...</span>
          </label>
          )}
        </div>
      </div>

      <div className="library-layout__row">
        <Buttons activeBtn={activeBtn} setActiveBtn={setActiveBtn} btns={btns} />
        <Images images={images} />
      </div>
    </div>
  );
};

Library.propTypes = {
  images: PropTypes.arrayOf(PropTypes.string),
  btns: PropTypes.arrayOf(PropTypes.shape({ name: PropTypes.string, icon: PropTypes.string })),
  addImages: PropTypes.func,
  title: PropTypes.string,
};

Library.defaultProps = {
  images: [
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg',
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg',
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg',
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg',
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg',
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg',
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg',
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg',
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg',
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg',
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg',
  ],
  btns: librarybtns,
  title: 'Add Images',
};

export default Library;
