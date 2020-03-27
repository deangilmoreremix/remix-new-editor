import React from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

import trashIcon from '../../../public/static/images/trash.svg';
import addIcon from '../../../public/static/images/add-white.svg';

const LibraryContent = ({ items, onSelect, activeBtn, onDelete }) => (
  <>
    {
        items && items.length
          && (
            <div className="library__images">
              {
                items.map(src => (
                  <div
                    key={src}
                    className="library__image"
                  >
                    <img src={src} alt="" />
                    <div className="library__image-actions">
                      {
                        activeBtn === 'USER' && (
                          <button className="library__image-delete" onClick={() => onDelete(src)}>
                            <SVGInline
                              className="library__image-icon"
                              svg={trashIcon}
                            />
                          </button>
                        )
                      }
                      <button className="library__image-add" onClick={() => onSelect(src)}>
                        <SVGInline
                          className="library__image-icon"
                          svg={addIcon}
                        />
                      </button>
                    </div>
                  </div>
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
  activeBtn: PropTypes.string.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default LibraryContent;
