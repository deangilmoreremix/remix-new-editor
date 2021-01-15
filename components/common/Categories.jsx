import React from 'react';
import classnames from 'classnames';

import List from './gallery/List';

import PropTypes from '../../lib/PropTypes';
import ListPropType from '../../lib/prop-types/ListPropType';

const Categories = React.memo(({ list, dispatchList, select, className }) => {
  if (!list.init) {
    return null;
  }

  return (
    <div className={className}>
      <div className="categories-header first-title">Browse templates</div>
      <button
        className={classnames('categories-subheader', 'second-title',
          { 'active-category': !list.activeItem })}
        onClick={() => select()}
      >
        All templates
      </button>
      <List
        list={list}
        dispatchList={dispatchList}
        className="categories-list"
        contentClassName="library__items"
      />
    </div>
  );
});

Categories.propTypes = {
  list: ListPropType,
  className: PropTypes.string,
  select: PropTypes.func.isRequired,
  dispatchList: PropTypes.func.isRequired,
};

export default Categories;
