import React, { Fragment } from 'react';
import { Waypoint } from 'react-waypoint';
import classnames from 'classnames';

import PropTypes from '../../../lib/PropTypes';

import { LibrarySpinner } from '../../media/Loader';

const List = ({ items, hasMore, uploadNewItems, handleSelect, activeItem, isLoading }) => (
  <div className="project-data-list">
    {items && items.length ? (
      <Fragment>
        {items.map((item) => (
          <button
            key={item._id}
            className={classnames(
              'project-data-list__button',
              { 'project-data-list__button-active': activeItem && activeItem._id === item._id },
            )}
            onClick={() => handleSelect(item)}
          >
            {item.project.name}
          </button>
        ))}
      </Fragment>
    ) : null}
    {isLoading && hasMore && <LibrarySpinner />}
    {!isLoading && hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems}><span className="project-data-list-waypoint" /></Waypoint>}
  </div>
);

List.propTypes = {
  items: PropTypes.arrayOrObservableArrayOf(
    PropTypes.shape(),
  ),
  hasMore: PropTypes.bool.isRequired,
  uploadNewItems: PropTypes.func.isRequired,
  handleSelect: PropTypes.func.isRequired,
  activeItem: PropTypes.shape({
    _id: PropTypes.string.isRequired,
  }),
  isLoading: PropTypes.bool.isRequired,
};

export default List;
