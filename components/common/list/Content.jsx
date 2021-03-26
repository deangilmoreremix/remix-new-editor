import React, { useMemo } from 'react';
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
  withoutParent,
}) => {
  const content = useMemo(() => (
    <>
      {items && items.length ? (
        <>
          {items.map((item) => (
            <Element item={item} key={item._id} activeItem={activeItem} />
          ))}
        </>
      ) : null}
      {isLoading && hasMore && <LibrarySpinner />}
      {
        !isLoading && hasMore && (
          <Waypoint bottomOffset="3%" onEnter={uploadNewItems}>
            <span className="list-waypoint" />
          </Waypoint>
        )
      }
    </>
  ), [activeItem, hasMore, isLoading, items]);

  return (
    withoutParent ? content : (
      <div className={className}>
        {content}
      </div>
    )
  );
};

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
  withoutParent: PropTypes.bool,
};
export default Content;
