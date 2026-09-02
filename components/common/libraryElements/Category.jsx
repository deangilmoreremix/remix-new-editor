import React from 'react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';


const Category = React.memo((props) => {
  const { item, onClick, activeItem } = props;
  return (
    <button
      className={classnames('small-text', 'category',
        { 'active-category': activeItem && item._id === activeItem._id })}
      onClick={() => onClick(item)}
    >
      {item.name}
    </button>
  );
});

Category.propTypes = {
  item: PropTypes.shape({
    name: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
  }).isRequired,
  onClick: PropTypes.func.isRequired,
  activeItem: PropTypes.shape({
    name: PropTypes.string.isRequired,
    _id: PropTypes.string.isRequired,
  }),
};

export default Category;
