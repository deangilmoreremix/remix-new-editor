import React from 'react';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';


const Category = React.memo((props) => {
  const { item, onClick, activeItem } = props;
  return (
    <button
      className={classnames('small-text', 'category',
        { 'active-category': item._id === activeItem })}
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
  activeItem: PropTypes.string,
};

export default Category;
