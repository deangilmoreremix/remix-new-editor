import React, { Fragment } from 'react';
import { Waypoint } from 'react-waypoint';
import PropTypes from '../../../lib/PropTypes';
import { LibrarySpinner } from '../../media/Loader';

const Content = ({
  items,
  hasMore,
  uploadNewItems,
  isLoading,
  element: Element,
  className,
  activeItem,
}) => (
  <div className={className}>
    {items && items.length ? (
      <Fragment>
        {items.map((item) => (
          <Element item={item} key={item._id} activeItem={activeItem} />
        ))}
      </Fragment>
    ) : null}
    {isLoading && hasMore && <LibrarySpinner />}
    {
      !isLoading && hasMore && (
        <Waypoint bottomOffset="3%" onEnter={uploadNewItems}>
          <span className="list-waypoint" />
        </Waypoint>
      )
    }
  </div>
);

Content.defaultProps = {
  className: 'list-items',
};

Content.propTypes = {
  items: PropTypes.arrayOrObservableArrayOf(
    PropTypes.shape(),
  ),
  hasMore: PropTypes.bool.isRequired,
  uploadNewItems: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  element: PropTypes.func.isRequired,
  className: PropTypes.string,
  activeItem: PropTypes.string,
};
export default Content;
