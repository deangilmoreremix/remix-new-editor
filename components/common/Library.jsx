import React, { useState } from 'react';

import ImageProviderList from './libraryes/ImageProviderList';
import LibraryContent from './libraryes/LibraryContent';
import PropTypes from '../../lib/PropTypes';
import {imageProviders} from '../../lib/constants/library';

const Library = ({ images, providers, addImages, title, onSearch }) => {
  const [viewPlaceholder, setViewPlaceholder] = useState(true);
  const [query, setQuery] = useState('');
  const [activeBtn, setActiveBtn] = useState(null);

  const handleChange = e => setQuery(e.target.value);

  const handleFocus = () => setViewPlaceholder(false);

  const handleBlur = () => {
    if (!query) {
      setViewPlaceholder(true);
    }
  };

  const handleSearch = (e) => {
    if (e.keyCode === 13 && query) {
      onSearch(query);
    }
  };

  const handleImageSelect = (img) => {
    console.log(img);
  };

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
            value={query}
            onChange={handleChange}
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
        <ImageProviderList
          activeItem={activeBtn}
          onSelectItem={setActiveBtn}
          items={providers}
        />
        <LibraryContent images={images} onSelect={handleImageSelect} />
      </div>
    </div>
  );
};

Library.propTypes = {
  images: PropTypes.arrayOf(PropTypes.string),
  providers: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string, icon: PropTypes.string,
  })),
  addImages: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  onSearch: PropTypes.func.isRequired,
};

Library.defaultProps = {
  images: [
    'https://static-cdn.123rf.com/images/v5/index-thumbnail/84170952-b.jpg',
    'https://www.istockphoto.com/resources/images/PhotoFTLP/Essential-images-we-love-1055891344.jpg',
    'https://cdn.pixabay.com/photo/2015/04/23/22/00/tree-736885__340.jpg',
    'https://cdn.pixabay.com/photo/2015/02/24/15/41/dog-647528__340.jpg',
    'https://www.vitalimages.com/wp-content/uploads/HIMSSHomeBanner2.jpg',
    'https://media-cdn.tripadvisor.com/media/photo-s/14/19/12/cb/beautiful-sunset-from.jpg',
    'https://s.ftcdn.net/v2013/pics/all/curated/RKyaEDwp8J7JKeZWQPuOVWvkUjGQfpCx_cover_580.jpg?r=1a0fc22192d0c808b8bb2b9bcfbf4a45b1793687',
    'https://cdn.pixabay.com/photo/2013/07/21/13/00/rose-165819__340.jpg',
    'https://cdn.pixabay.com/photo/2015/12/01/20/28/road-1072823__340.jpg',
    'https://www.istockphoto.com/resources/images/PhotoFTLP/NatureLandscapes-519760984.jpg',
  ],
  providers: imageProviders,
};

export default Library;
