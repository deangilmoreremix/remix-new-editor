import React from 'react';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

import useUserStore from '../../hooks/useUserStore';

import trashIcon from '../../../public/static/svgImages/trash.svg';
import addIcon from '../../../public/static/svgImages/add-white.svg';

const ContentItem = ({ item, onDelete, onSelect }) => {
  const { isSuperAdmin } = useUserStore();

  return (
    <div className="stickers-content__item">
      {item.preview && (
        <div className="stickers-content__img">
          <img src={item.preview} alt="" />
        </div>
      )}
      {
        isSuperAdmin ? (
          <div className="stickers-content__actions">
            <button className="stickers-content__delete" onClick={() => onDelete(item._id)}>
              <SVGInline
                className="stickers-content__icon"
                svg={trashIcon}
              />
            </button>
            <button className="stickers-content__append" onClick={() => onSelect(item)}>
              <SVGInline
                className="stickers-content__icon"
                svg={addIcon}
              />
            </button>
          </div>
        ) : (
          <button type="button" className="animation-preview__add" onClick={() => onSelect(item)} />
        )
      }
    </div>
  );
};

ContentItem.propTypes = {
  item: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    preview: PropTypes.string.isRequired,
  }).isRequired,
  onDelete: PropTypes.func,
  onSelect: PropTypes.func.isRequired,
};

ContentItem.defaultProps = {
  onDelete: () => {},
};

export default ContentItem;
