import React, { useState } from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

import useUserStore from '../../hooks/useUserStore';

import ItemPreview from './ItemPreview';

import trashIcon from '../../../public/static/svgImages/trash.svg';
import addIcon from '../../../public/static/svgImages/add-white.svg';

const ContentItem = ({ item, onDelete, onSelect }) => {
  const { isSuperAdmin } = useUserStore();
  const [isPlaying, setIsPlaying] = useState(false);

  const onMouseEnter = () => {
    setIsPlaying(true);
  };

  const onMouseLeave = () => {
    setIsPlaying(false);
  };

  return (
    <div className="lower-thirds-content__item" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {item.preview && !isPlaying && (
        <div className="lower-thirds-content__img">
          <img src={item.preview} alt="" />
        </div>
      )}

      {isPlaying && <ItemPreview item={item} />}

      {
        isSuperAdmin ? (
          <div className="lower-thirds-content__actions">
            <button className="stickers-content__delete" onClick={() => onDelete(item._id)}>
              <SVGInline
                className="lower-thirds-content__icon"
                svg={trashIcon}
              />
            </button>
            <button className="lower-thirds-content__append" onClick={() => onSelect(item)}>
              <SVGInline
                className="lower-thirds-content__icon"
                svg={addIcon}
              />
            </button>
          </div>
        ) : (
          <button className="animation-preview__add" onClick={() => onSelect(item)} />
        )
      }
    </div>
  );
};

ContentItem.propTypes = {
  item: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    preview: PropTypes.string.isRequired,
    data: PropTypes.string.isRequired,
  }).isRequired,
  onDelete: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default ContentItem;
