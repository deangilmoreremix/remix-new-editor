import React, { useState } from 'react';
import classnames from 'classnames';
import SVGInline from 'react-svg-inline';

import PropTypes from '../../../lib/PropTypes';

import removeFolderIcon from '../../../public/static/svgImages/projects/remove-folder-icon.svg';
import editFolderIcon from '../../../public/static/svgImages/projects/edit-folder-icon.svg';

const Folder = React.memo((props) => {
  const { item, onClick, activeItem, onEdit, onDelete } = props;
  const [isHover, setIsHover] = useState(false);

  return (
    <div
      className="small-text category folder"
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      <button
        className={classnames('small-text', 'category', 'width-auto',
          { 'active-category': activeItem && item._id === activeItem._id })}
        onClick={() => onClick(item)}
      >
        {item.title}
      </button>
      {isHover && (
        <div className="create-folder__icons-box">
          <SVGInline
            className="create-folder__hover-icon"
            svg={editFolderIcon}
            onClick={() => onEdit(item)}
          />
          <SVGInline
            className="create-folder__hover-icon"
            svg={removeFolderIcon}
            onClick={() => onDelete(item)}
          />
        </div>
      )}
    </div>
  );
});

Folder.propTypes = {
  item: PropTypes.shape({
    title: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
  }).isRequired,
  onClick: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  activeItem: PropTypes.shape({
    title: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
  }),
};

export default Folder;
