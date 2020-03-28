import React from 'react';

import PropTypes from '../../../lib/PropTypes';

const LibraryContent = ({ items, onSelect }) => (
  <>
    {
        items && items.length
          && (
            <div className="library-layout__images">
              {
                items.map(src => (
                  <button
                    type="button"
                    key={src}
                    className="library-layout__image"
                    onClick={() => onSelect(src)}
                  >
                    <img src={src} alt="" />
                  </button>
                ))
            }
            </div>
          )
      }
  </>
);

LibraryContent.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string.isRequired),
  onSelect: PropTypes.func.isRequired,
};

export default LibraryContent;
