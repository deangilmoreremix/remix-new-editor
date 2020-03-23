import React from 'react';

import PropTypes from '../../../lib/PropTypes';

const LibraryContent = ({ items, onSelect }) => {
  const selectImage = img => () => onSelect(img);

  return (
    <>
      {
        items && items.length
          ? (
            <div className="library-layout__images">
              {
                items.map(src => (
                  <button
                    type="button"
                    key={src}
                    className="library-layout__image"
                    onClick={selectImage(src)}
                  >
                    <img src={src} alt="" />
                  </button>
                ))
            }
            </div>
          )
          : <p>Nothing found</p>
      }
    </>
  );
};

LibraryContent.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string),
  onSelect: PropTypes.func,
};

export default LibraryContent;
