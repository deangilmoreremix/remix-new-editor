import React, { useCallback, useState } from 'react';
import Buttons from './Buttons';
import Images from './Images';

// test array. After need delete
const images = [
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
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg'
];

const Index = () => {
  const [viewPlaceholder, setViewPlaceholder] = useState(true);
  const [search, setSearch] = useState('');
  const [activeBtn, setActiveBtn] = useState(null);

  // === actions ===
  const handleFocus = useCallback(() => {
    setViewPlaceholder(false);
  }, []);

  const handleBlur = useCallback(() => {
    if (!search) setViewPlaceholder(true);
  }, [search]);

  const addImages = () => {
    console.log('click');
  };

  const handleSearch = (e) => {
    if (e.keyCode === 13 && search) {
      console.log(search);
    }
  };
  // === actions ===

  return (
    <div className="library-layout col-6">
      <h2 className="library-layout__title">Add Images</h2>

      <div className="library-layout__row library-layout__row-first">
        <div>
          <button className="library-layout__add" onClick={addImages}>Add Images</button>
        </div>
        <div className="library-layout__block-search">
          <input
            className="library-layout__search"
            id="library-layout__search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
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
        <Buttons activeBtn={activeBtn} setActiveBtn={setActiveBtn} />
        <Images images={images} />
      </div>

      {/*<button className="library-layout__arrow">*/}
      {/*  */}
      {/*</button>*/}
    </div>
  );
};

export default Index;
