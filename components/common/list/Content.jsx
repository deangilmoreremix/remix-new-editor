import React, { Fragment } from 'react';
import { Waypoint } from 'react-waypoint';
import classnames from 'classnames';
import PropTypes from '../../../lib/PropTypes';
import { LibrarySpinner } from '../../media/Loader';

const Content = ({ items, hasMore, uploadNewItems, isLoading, element: Element, className }) => (
  <div className="presets-list">
    {items && items.length && (
      <Fragment>
        {items.map((item) => (
          <Element item={item} />
        ))}
      </Fragment>
    )}
    {isLoading && hasMore && <LibrarySpinner />}
    {!isLoading && hasMore && <Waypoint bottomOffset="3%" onEnter={uploadNewItems}><span className="preset-waypoint" /></Waypoint>}
  </div>
);

Content.propTypes = {
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
  element: PropTypes.element,
};
export default Content;
